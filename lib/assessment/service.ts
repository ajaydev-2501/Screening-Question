import "server-only";

import { randomInt } from "node:crypto";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  assessmentAnswers,
  assessments,
  assessmentOptions,
  candidates,
  productivityTools,
  toolFollowups,
  toolSelections,
} from "@/db/schema";
import { normalizeEmail, type NormalizedEmail } from "@/lib/email";
import {
  QUESTIONS,
  SCORED_QUESTION_COUNT,
  TOOL_INVENTORY_KEY,
  TOTAL_SCREEN_COUNT,
  optionKeyToQuestionKey,
  type Question,
} from "@/lib/assessment/questions";
import {
  currentQuestionBankVersion,
  loadQuestionBank,
} from "@/lib/assessment/question-bank";
import {
  TOOL_CATALOG_VERSION,
  TOOLS_BY_KEY,
  isKnownToolKey,
} from "@/lib/assessment/tool-catalog";
import {
  MAX_PRODUCTIVITY_TOOLS,
  REAL_WORLD_EXAMPLE_MIN_LENGTH,
  isKnownPrimaryAgentKey,
  isKnownUsageDepthKey,
} from "@/lib/assessment/tool-inventory";
import {
  scoreAssessment,
  serializeSectionScores,
  IncompleteAssessmentError,
  type AssessmentResult,
} from "@/lib/assessment/scoring";
import type { ToolInventoryInput } from "@/lib/validation";
import type {
  AssessmentState,
  Screen,
  ToolInventoryState,
} from "@/lib/assessment/service-types";

export { IncompleteAssessmentError };

/**
 * The candidate-visible shapes live in `./service-types`, which is free of `server-only` so client
 * components can name them. They are re-exported here so server code has one import to reach for.
 */
export type { AssessmentState, Screen, ToolInventoryState };

export type StartResult =
  | { outcome: "created"; assessmentId: string; candidateId: string }
  | { outcome: "resumed"; assessmentId: string; candidateId: string }
  | { outcome: "already-submitted"; assessmentId: string; candidateId: string }
  | { outcome: "invalid-email"; normalized: string | null };

export class AssessmentNotWritableError extends Error {
  constructor() {
    super("This assessment has already been submitted and can no longer be changed.");
    this.name = "AssessmentNotWritableError";
  }
}

export class UnknownAnswerError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "UnknownAnswerError";
  }
}

/** Carries a field-to-message map so the form can show the problem without exposing internals. */
export class InventoryValidationError extends Error {
  readonly fields: Record<string, string>;

  constructor(fields: Record<string, string>) {
    super("The tool inventory could not be saved.");
    this.name = "InventoryValidationError";
    this.fields = fields;
  }
}

/**
 * A cryptographically random shuffle of the 20 scored question keys.
 *
 * `randomInt` rather than `Math.random` because this order is persisted and reused for the life of
 * the assessment: a predictable shuffle would let two candidates collude by comparing move
 * numbers. The order is generated exactly once, at creation, and never regenerated — re-shuffling
 * on resume would silently invalidate the answers already stored against it.
 */
export function randomQuestionOrder(): string[] {
  const keys = QUESTIONS.map((q) => q.key);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const held = keys[i]!;
    keys[i] = keys[j]!;
    keys[j] = held;
  }
  return keys;
}

/**
 * Registers a candidate and creates their single assessment, pinned to the current bank version.
 *
 * One attempt per email is checked across versions, not within one: the bank can publish new
 * versions while candidates are mid-flight, and a returning candidate must resume the assessment
 * they already have — at the wording they started on — rather than unlock a second attempt merely
 * because the bank moved. The insert still races safely: the unique indexes on
 * `candidates.normalized_email` and `(candidate_id, assessment_version)` make a simultaneous
 * double-click a no-op, and the read-back returns the row the winner created.
 */
export async function startAssessment(input: {
  firstName: string;
  email: string;
}): Promise<StartResult> {
  let normalized: NormalizedEmail;
  try {
    normalized = normalizeEmail(input.email);
  } catch {
    return { outcome: "invalid-email", normalized: null };
  }

  const version = await currentQuestionBankVersion();

  const inserted = await db
    .insert(candidates)
    .values({
      firstName: input.firstName.trim(),
      normalizedEmail: normalized.normalized,
    })
    .onConflictDoNothing({ target: candidates.normalizedEmail })
    .returning({ id: candidates.id });

  const candidateId =
    inserted[0]?.id ??
    (
      await db
        .select({ id: candidates.id })
        .from(candidates)
        .where(eq(candidates.normalizedEmail, normalized.normalized))
        .limit(1)
    )[0]?.id;

  if (!candidateId) {
    throw new Error("Could not resolve a candidate record for this email.");
  }

  const existing = await db
    .select({ id: assessments.id, status: assessments.status })
    .from(assessments)
    .where(eq(assessments.candidateId, candidateId))
    .limit(1);

  if (existing[0]) {
    return {
      outcome: existing[0].status === "submitted" ? "already-submitted" : "resumed",
      assessmentId: existing[0].id,
      candidateId,
    };
  }

  const created = await db
    .insert(assessments)
    .values({
      candidateId,
      questionOrder: randomQuestionOrder(),
      assessmentVersion: version,
      toolCatalogVersion: TOOL_CATALOG_VERSION,
    })
    .onConflictDoNothing({
      target: [assessments.candidateId, assessments.assessmentVersion],
    })
    .returning({ id: assessments.id, status: assessments.status });

  if (created[0]) {
    return { outcome: "created", assessmentId: created[0].id, candidateId };
  }

  // Lost a create race with a simultaneous request for the same email: the winner's row is the
  // one this candidate resumes.
  const raced = await db
    .select({ id: assessments.id, status: assessments.status })
    .from(assessments)
    .where(eq(assessments.candidateId, candidateId))
    .limit(1);

  if (!raced[0]) {
    throw new Error("Could not resolve an assessment record for this candidate.");
  }

  return {
    outcome: raced[0].status === "submitted" ? "already-submitted" : "resumed",
    assessmentId: raced[0].id,
    candidateId,
  };
}

/** What the landing page shows a returning candidate before they re-enter the flow. */
export async function resumeSummary(assessmentId: string): Promise<{
  firstName: string;
  status: "in_progress" | "submitted";
  answeredCount: number;
  move: number;
} | null> {
  const state = await loadAssessmentState(assessmentId);
  if (!state) return null;

  const [row] = await db
    .select({ firstName: candidates.firstName })
    .from(candidates)
    .innerJoin(assessments, eq(assessments.candidateId, candidates.id))
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  if (!row) return null;

  return {
    firstName: row.firstName,
    status: state.status,
    answeredCount: state.answeredCount,
    move: firstOpenMove(state) ?? TOTAL_SCREEN_COUNT,
  };
}

export async function loadAssessmentState(
  assessmentId: string,
): Promise<AssessmentState | null> {
  const row = await db
    .select({
      id: assessments.id,
      status: assessments.status,
      submittedAt: assessments.submittedAt,
      questionOrder: assessments.questionOrder,
      assessmentVersion: assessments.assessmentVersion,
      toolCatalogVersion: assessments.toolCatalogVersion,
      firstName: candidates.firstName,
    })
    .from(assessments)
    .innerJoin(candidates, eq(assessments.candidateId, candidates.id))
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  if (!row[0]) return null;

  const [bank, answerRows, inventory] = await Promise.all([
    loadQuestionBank(row[0].assessmentVersion),
    db
      .select({
        questionKey: assessmentAnswers.questionKey,
        optionKey: assessmentOptions.optionKey,
        skipped: assessmentAnswers.skipped,
      })
      .from(assessmentAnswers)
      .leftJoin(
        assessmentOptions,
        eq(assessmentAnswers.optionId, assessmentOptions.id),
      )
      .where(eq(assessmentAnswers.assessmentId, assessmentId)),
    loadInventory(assessmentId, row[0].toolCatalogVersion),
  ]);

  const order = sanitizeOrder(row[0].questionOrder, bank);

  const answers: Record<string, string> = {};
  const skipped = new Set<string>();
  for (const a of answerRows) {
    if (a.skipped) skipped.add(a.questionKey);
    else if (a.optionKey) answers[a.questionKey] = a.optionKey;
  }

  return {
    assessmentId: row[0].id,
    firstName: row[0].firstName,
    status: row[0].status,
    submittedAt: row[0].submittedAt,
    screens: screensFor(order, bank),
    answers,
    skippedKeys: order.filter((key) => skipped.has(key)),
    answeredCount: order.filter((key) => key in answers).length,
    inventory,
  };
}

/**
 * Rebuilds the screen list from the persisted order and the version's bank.
 *
 * Keys that no longer exist in the pinned version's bank are dropped rather than trusted: if a
 * question is retired in a later version, an old assessment's stored order must not be able to
 * inject a key the bank it renders from does not know.
 */
function sanitizeOrder(stored: string[], bank: Question[]): string[] {
  const known = new Set(bank.map((q) => q.key));
  const permitted = stored.filter((key) => known.has(key));
  return permitted.length === SCORED_QUESTION_COUNT ? permitted : bank.map((q) => q.key);
}

function screensFor(order: string[], bank: Question[]): Screen[] {
  const byKey = new Map(bank.map((q) => [q.key, q]));
  const screens: Screen[] = order.flatMap((key, index) => {
    const question = byKey.get(key);
    return question
      ? [{ kind: "question" as const, index, move: index + 1, question }]
      : [];
  });
  screens.push({
    kind: "inventory",
    index: SCORED_QUESTION_COUNT,
    move: TOTAL_SCREEN_COUNT,
  });
  return screens;
}

/**
 * The move a resuming candidate should land on — the first screen they neither answered nor
 * skipped — or `null` when every screen is resolved and the confirmation is the next thing they
 * should see.
 */
export function firstOpenMove(state: AssessmentState): number | null {
  const skipped = new Set(state.skippedKeys);
  for (const screen of state.screens) {
    if (
      screen.kind === "question" &&
      !(screen.question.key in state.answers) &&
      !skipped.has(screen.question.key)
    ) {
      return screen.move;
    }
  }
  return isInventoryComplete(state.inventory) || state.inventory.skipped
    ? null
    : TOTAL_SCREEN_COUNT;
}

/**
 * Whether the inventory is complete enough to submit.
 *
 * The tool list itself is optional — a candidate may genuinely have used none of the catalog — but
 * the three follow-ups are not. They are the whole reason the inventory is unscored: selecting
 * "Claude Code" proves nothing about skill, and it is the account of a real task, planned and
 * verified, that gives an interviewer something to ask about.
 */
export function isInventoryComplete(
  inventory: Pick<
    ToolInventoryState,
    "primaryAgentKey" | "usageDepthKey" | "realWorldExample"
  >,
): boolean {
  return (
    inventory.primaryAgentKey !== null &&
    inventory.usageDepthKey !== null &&
    inventory.realWorldExample !== null &&
    inventory.realWorldExample.trim().length >= REAL_WORLD_EXAMPLE_MIN_LENGTH
  );
}

/**
 * Records one answer.
 *
 * The option key embeds its question key (`q07-b`), so checking the two agree is what stops a
 * request from pairing question 7 with question 12's option. The option is then resolved against
 * the pinned version's rows — the same ones the candidate was shown — so an invented key is
 * rejected here rather than by a foreign-key error the caller cannot interpret.
 *
 * The assessment's status and order are read before the write and status is re-checked inside the
 * write transaction: a submit can land in between, and a submitted record must accept no further
 * answers. The bank rows themselves are immutable per version, so reading them outside the
 * transaction is safe by construction.
 */
export async function saveAnswer(
  assessmentId: string,
  questionKey: string,
  optionKey: string,
): Promise<{ saved: true }> {
  if (optionKeyToQuestionKey(optionKey) !== questionKey) {
    throw new UnknownAnswerError("That option does not belong to this question.");
  }

  const row = await db
    .select({
      status: assessments.status,
      questionOrder: assessments.questionOrder,
      assessmentVersion: assessments.assessmentVersion,
    })
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  if (!row[0]) throw new UnknownAnswerError("This assessment does not exist.");
  if (row[0].status !== "in_progress") {
    throw new AssessmentNotWritableError();
  }

  const [bank, option] = await Promise.all([
    loadQuestionBank(row[0].assessmentVersion),
    db
      .select({ id: assessmentOptions.id })
      .from(assessmentOptions)
      .where(
        and(
          eq(assessmentOptions.optionKey, optionKey),
          eq(assessmentOptions.version, row[0].assessmentVersion),
        ),
      )
      .limit(1),
  ]);

  if (!option[0]) {
    throw new UnknownAnswerError("That answer is not part of this assessment.");
  }
  if (!sanitizeOrder(row[0].questionOrder, bank).includes(questionKey)) {
    throw new UnknownAnswerError("That question is not part of this assessment.");
  }

  await db.transaction(async (tx) => {
    const guard = await tx
      .select({ status: assessments.status })
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!guard[0]) throw new UnknownAnswerError("This assessment does not exist.");
    if (guard[0].status !== "in_progress") {
      throw new AssessmentNotWritableError();
    }

    await tx
      .insert(assessmentAnswers)
      .values({
        assessmentId,
        questionKey,
        optionId: option[0]!.id,
      })
      .onConflictDoUpdate({
        target: [assessmentAnswers.assessmentId, assessmentAnswers.questionKey],
        // Clearing `skipped` is what makes an answered move out of a previously skipped one: the
        // candidate changing their mind must leave no trace of the skip behind.
        set: { optionId: option[0]!.id, skipped: false, updatedAt: new Date() },
      });

    await tx
      .update(assessments)
      .set({ lastActivityAt: new Date() })
      .where(eq(assessments.id, assessmentId));
  });

  return { saved: true };
}

/**
 * Records the candidate explicitly declining a scored move.
 *
 * Any option stored before is discarded: "skip" must mean the move has no answer, not "my earlier
 * click also counted". The move stops blocking submission but the database keeps the decline, so
 * scoring can charge it three available points and zero earned ones — a skip can lower a score,
 * never launder a bad answer away.
 */
export async function skipAnswer(
  assessmentId: string,
  questionKey: string,
): Promise<{ saved: true }> {
  const row = await db
    .select({
      status: assessments.status,
      questionOrder: assessments.questionOrder,
      assessmentVersion: assessments.assessmentVersion,
    })
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  if (!row[0]) throw new UnknownAnswerError("This assessment does not exist.");
  if (row[0].status !== "in_progress") {
    throw new AssessmentNotWritableError();
  }

  const bank = await loadQuestionBank(row[0].assessmentVersion);
  if (!sanitizeOrder(row[0].questionOrder, bank).includes(questionKey)) {
    throw new UnknownAnswerError("That question is not part of this assessment.");
  }

  await db.transaction(async (tx) => {
    const guard = await tx
      .select({ status: assessments.status })
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!guard[0]) throw new UnknownAnswerError("This assessment does not exist.");
    if (guard[0].status !== "in_progress") {
      throw new AssessmentNotWritableError();
    }

    await tx
      .insert(assessmentAnswers)
      .values({ assessmentId, questionKey, optionId: null, skipped: true })
      .onConflictDoUpdate({
        target: [assessmentAnswers.assessmentId, assessmentAnswers.questionKey],
        set: { optionId: null, skipped: true, updatedAt: new Date() },
      });

    await tx
      .update(assessments)
      .set({ lastActivityAt: new Date() })
      .where(eq(assessments.id, assessmentId));
  });

  return { saved: true };
}

/**
 * Replaces the whole Question 21 inventory in one transaction.
 *
 * Replace rather than patch: the candidate edits a single multi-select surface and autosaves it,
 * so the stored set must equal what they last saw. A delete-then-insert inside one transaction is
 * simpler to reason about than diffing, and it cannot leave a deselected tool behind.
 *
 * Every key is checked against the catalog version stamped on the assessment, not against the
 * module's current version, so a catalog revision cannot retroactively invalidate stored records.
 */
export async function saveToolInventory(
  assessmentId: string,
  input: ToolInventoryInput,
): Promise<{ saved: true }> {
  const errors: Record<string, string> = {};

  const seen = new Set<string>();
  const selections: { toolKey: string; customName: string | null }[] = [];

  for (const [i, selection] of input.selections.entries()) {
    const tool = TOOLS_BY_KEY.get(selection.toolKey);
    if (!tool || !isKnownToolKey(selection.toolKey)) {
      errors[`selections.${i}`] = "One of the selected tools is not in the catalog.";
      continue;
    }
    if (seen.has(tool.key)) continue;
    seen.add(tool.key);

    if (selection.customName && !tool.isOther) {
      errors[`selections.${i}`] = "Only an “Other” entry accepts a custom tool name.";
      continue;
    }
    if (tool.isOther && !selection.customName) {
      errors[`selections.${i}`] = `Name the tool you mean by “${tool.name}”.`;
      continue;
    }
    selections.push({ toolKey: tool.key, customName: selection.customName ?? null });
  }

  const ranked: { toolKey: string; customName: string | null; position: number }[] = [];
  input.productivityTools.forEach((tool, i) => {
    if (!seen.has(tool.toolKey)) {
      errors[`productivityTools.${i}`] =
        "Choose your top three from the tools you selected above.";
      return;
    }
    if (ranked.some((r) => r.toolKey === tool.toolKey)) return;
    if (ranked.length >= MAX_PRODUCTIVITY_TOOLS) {
      errors["productivityTools"] = "Choose at most three tools here.";
      return;
    }
    ranked.push({
      toolKey: tool.toolKey,
      customName: tool.customName ?? null,
      position: ranked.length + 1,
    });
  });

  // Nulls are accepted: this runs on every autosave, and the candidate reaches these three fields
  // only after working through the tool list. What must hold is that any value that *is* supplied
  // is one the catalog recognises. Completeness is checked at submit time instead.
  if (input.primaryAgentKey && !isKnownPrimaryAgentKey(input.primaryAgentKey)) {
    errors["primaryAgentKey"] = "Choose the AI coding agent you use most.";
  }
  if (input.primaryAgentKey === "other" && !input.primaryAgentOther) {
    errors["primaryAgentOther"] = "Name the AI coding agent you use most.";
  }
  if (input.usageDepthKey && !isKnownUsageDepthKey(input.usageDepthKey)) {
    errors["usageDepthKey"] = "Choose how you typically use your primary AI tool.";
  }

  if (Object.keys(errors).length > 0) throw new InventoryValidationError(errors);

  await db.transaction(async (tx) => {
    const row = await tx
      .select({
        status: assessments.status,
        toolCatalogVersion: assessments.toolCatalogVersion,
      })
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!row[0]) throw new UnknownAnswerError("This assessment does not exist.");
    if (row[0].status !== "in_progress") {
      throw new AssessmentNotWritableError();
    }

    const catalogVersion = row[0].toolCatalogVersion;

    await tx
      .delete(toolSelections)
      .where(eq(toolSelections.assessmentId, assessmentId));
    await tx
      .delete(productivityTools)
      .where(eq(productivityTools.assessmentId, assessmentId));

    if (selections.length > 0) {
      await tx.insert(toolSelections).values(
        selections.map((s) => ({
          assessmentId,
          catalogVersion,
          toolKey: s.toolKey,
          customName: s.customName,
        })),
      );
    }
    if (ranked.length > 0) {
      await tx.insert(productivityTools).values(
        ranked.map((r) => ({
          assessmentId,
          toolKey: r.toolKey,
          customName: r.customName,
          position: r.position,
        })),
      );
    }

    await tx
      .insert(toolFollowups)
      .values({
        assessmentId,
        primaryAgentKey: input.primaryAgentKey,
        primaryAgentOther: input.primaryAgentOther ?? null,
        usageDepth: input.usageDepthKey,
        realWorldExample: input.realWorldExample,
      })
      .onConflictDoUpdate({
        target: toolFollowups.assessmentId,
        set: {
          primaryAgentKey: input.primaryAgentKey,
          primaryAgentOther: input.primaryAgentOther ?? null,
          usageDepth: input.usageDepthKey,
          realWorldExample: input.realWorldExample,
          // Any save edits the inventory, so the move is engaged and a previous skip is gone.
          skipped: false,
          updatedAt: new Date(),
        },
      });

    await tx
      .update(assessments)
      .set({ lastActivityAt: new Date() })
      .where(eq(assessments.id, assessmentId));
  });

  return { saved: true };
}

/**
 * Records the candidate declining Question 21 without touching what they already wrote.
 *
 * Deliberately asymmetric with a scored skip: the inventory is a draft surface, and tool ticks may
 * have landed before the candidate decided the follow-ups were not for them. Deleting that work on
 * a skip click would be hostile, so the skip only waives the follow-up completeness requirement at
 * submit time. If the inventory is complete all the same, complete wins in every display — the
 * skip flag is a fallback, not an eraser.
 */
export async function skipInventory(
  assessmentId: string,
): Promise<{ saved: true }> {
  await db.transaction(async (tx) => {
    const row = await tx
      .select({ status: assessments.status })
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!row[0]) throw new UnknownAnswerError("This assessment does not exist.");
    if (row[0].status !== "in_progress") {
      throw new AssessmentNotWritableError();
    }

    await tx
      .insert(toolFollowups)
      .values({ assessmentId, skipped: true })
      .onConflictDoUpdate({
        target: toolFollowups.assessmentId,
        set: { skipped: true, updatedAt: new Date() },
      });

    await tx
      .update(assessments)
      .set({ lastActivityAt: new Date() })
      .where(eq(assessments.id, assessmentId));
  });

  return { saved: true };
}

async function loadInventory(
  assessmentId: string,
  catalogVersion: number,
): Promise<ToolInventoryState> {
  const [selectionRows, productivityRows, followupRows] = await Promise.all([
    db
      .select({
        toolKey: toolSelections.toolKey,
        customName: toolSelections.customName,
      })
      .from(toolSelections)
      .where(
        and(
          eq(toolSelections.assessmentId, assessmentId),
          eq(toolSelections.catalogVersion, catalogVersion),
        ),
      ),
    db
      .select({
        toolKey: productivityTools.toolKey,
        customName: productivityTools.customName,
        position: productivityTools.position,
      })
      .from(productivityTools)
      .where(eq(productivityTools.assessmentId, assessmentId))
      .orderBy(asc(productivityTools.position)),
    db
      .select()
      .from(toolFollowups)
      .where(eq(toolFollowups.assessmentId, assessmentId))
      .limit(1),
  ]);

  const followup = followupRows[0];

  return {
    catalogVersion,
    selections: selectionRows,
    productivityTools: productivityRows.map((r) => ({
      toolKey: r.toolKey,
      customName: r.customName,
    })),
    primaryAgentKey: followup?.primaryAgentKey ?? null,
    primaryAgentOther: followup?.primaryAgentOther ?? null,
    usageDepthKey: followup?.usageDepth ?? null,
    realWorldExample: followup?.realWorldExample ?? null,
    skipped: followup?.skipped ?? false,
  };
}

export type SubmitOutcome =
  | { outcome: "submitted"; result: AssessmentResult }
  | { outcome: "already-submitted"; submittedAt: Date | null };

/**
 * Atomically submits and scores the assessment.
 *
 * The claim is a conditional `UPDATE ... WHERE status = 'in_progress' RETURNING id`. Two
 * simultaneous submits both read complete answers, but only one update matches the guard, so the
 * second gets zero rows back and reports `already-submitted` instead of scoring twice. No row
 * lock and no application-level flag is involved; the guard is the lock.
 *
 * Scoring happens after the claim but inside the same transaction, so a rubric gap throws and
 * rolls the claim back. A submitted assessment with no score would be worse than one the candidate
 * can still resubmit.
 */
export async function submitAssessment(
  assessmentId: string,
): Promise<SubmitOutcome> {
  return db.transaction(async (tx) => {
    const row = await tx
      .select({
        status: assessments.status,
        submittedAt: assessments.submittedAt,
        assessmentVersion: assessments.assessmentVersion,
      })
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!row[0]) throw new UnknownAnswerError("This assessment does not exist.");

    if (row[0].status === "submitted") {
      return { outcome: "already-submitted", submittedAt: row[0].submittedAt };
    }

    const answerRows = await tx
      .select({
        questionKey: assessmentAnswers.questionKey,
        optionKey: assessmentOptions.optionKey,
        skipped: assessmentAnswers.skipped,
      })
      .from(assessmentAnswers)
      .leftJoin(
        assessmentOptions,
        eq(assessmentAnswers.optionId, assessmentOptions.id),
      )
      .where(eq(assessmentAnswers.assessmentId, assessmentId));

    const answers = new Map<string, string>();
    const skipped = new Set<string>();
    for (const a of answerRows) {
      if (a.skipped) skipped.add(a.questionKey);
      else if (a.optionKey) answers.set(a.questionKey, a.optionKey);
    }

    // The bank read is version-pinned and its rows are immutable, so reading it on the shared
    // connection while this transaction holds the claim is stable by construction.
    const bank = await loadQuestionBank(row[0].assessmentVersion);

    // A skipped move is resolved: it does not block submission, it just scores nothing.
    const missing = bank
      .filter((q) => !answers.has(q.key) && !skipped.has(q.key))
      .map((q) => q.key);
    if (missing.length > 0) throw new IncompleteAssessmentError(missing);

    const claimed = await tx
      .update(assessments)
      .set({ status: "submitted", submittedAt: new Date() })
      .where(
        and(
          eq(assessments.id, assessmentId),
          eq(assessments.status, "in_progress"),
        ),
      )
      .returning({ id: assessments.id });

    if (claimed.length === 0) {
      const winner = await tx
        .select({ submittedAt: assessments.submittedAt })
        .from(assessments)
        .where(eq(assessments.id, assessmentId))
        .limit(1);
      return { outcome: "already-submitted", submittedAt: winner[0]?.submittedAt ?? null };
    }

    const result = scoreAssessment(answers, skipped, bank);

    await tx
      .update(assessments)
      .set({
        totalScore: result.totalScore,
        competencyScores: serializeSectionScores(result),
        resultDetail: serializeResult(result),
        submittedAt: new Date(),
      })
      .where(eq(assessments.id, assessmentId));

    return { outcome: "submitted", result };
  });
}

/**
 * The stored report shape. Plain data only: it is read back by the admin dashboard and by the CSV
 * export without re-running the rubric, so it must not depend on the current code's internals.
 * Schema 3 is the section/proficiency report; schema 2 records (weighted competencies) keep
 * rendering from their own frozen data.
 */
function serializeResult(result: AssessmentResult): Record<string, unknown> {
  return {
    schema: 3,
    totalScore: result.totalScore,
    band: result.band,
    answeredCount: result.answeredCount,
    totalQuestions: result.totalQuestions,
    skippedCount: result.skippedCount,
    sections: result.sections,
    strongest: result.strongest.map((s) => s.id),
    weakest: result.weakest.map((s) => s.id),
  };
}

export const SCREEN_COUNT = TOTAL_SCREEN_COUNT;
export const INVENTORY_MOVE = TOTAL_SCREEN_COUNT;
export const INVENTORY_SCREEN_KEY = TOOL_INVENTORY_KEY;

/** Touch without a write, so an idle candidate's session can be refreshed cheaply. */
export async function touchAssessment(assessmentId: string): Promise<void> {
  await db
    .update(assessments)
    .set({ lastActivityAt: sql`now()` })
    .where(eq(assessments.id, assessmentId));
}
