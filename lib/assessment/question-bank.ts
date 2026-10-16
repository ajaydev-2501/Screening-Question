import "server-only";

import { asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  assessmentOptions,
  assessmentQuestions,
  optionScores,
} from "@/db/schema";
import { bankFromRows } from "@/lib/assessment/bank-rows";
import { env } from "@/lib/env";
import { QUESTIONS, type Question } from "@/lib/assessment/questions";

/**
 * Reads and writes for the versioned question bank.
 *
 * Candidate content lives in the database so wording can be edited from the admin side; the
 * authored module stays as the bootstrap (via the seed) and as the fallback when a version has no
 * rows yet. A published version is immutable — an edit copies the whole bank forward to a new
 * version, so an assessment pinned to an older version keeps rendering the exact wording its
 * candidate saw.
 */

export class QuestionBankError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestionBankError";
  }
}

/**
 * The version a new assessment pins: the newest published bank. Falls back to the seed version so a
 * checkout that has never run `db:seed` still behaves exactly as before the bank moved to the
 * database (the seed will later write that version's rows).
 */
export async function currentQuestionBankVersion(): Promise<number> {
  const [row] = await db
    .select({ version: sql<number | null>`max(${assessmentQuestions.version})::int` })
    .from(assessmentQuestions);

  return row?.version ?? Number(env().ASSESSMENT_VERSION);
}

/**
 * The full bank for one version, in the candidate-facing `Question` shape.
 *
 * Bank rows are immutable once published, which is what lets callers hold the result across a
 * request. An empty version falls back to the authored bank; a partial row set does the same —
 * `bankFromRows` refuses to build a half bank.
 */
export async function loadQuestionBank(version: number): Promise<Question[]> {
  const questionRows = await db
    .select({
      id: assessmentQuestions.id,
      questionKey: assessmentQuestions.questionKey,
      prompt: assessmentQuestions.prompt,
      canonicalPosition: assessmentQuestions.canonicalPosition,
    })
    .from(assessmentQuestions)
    .where(eq(assessmentQuestions.version, version));

  if (questionRows.length === 0) return QUESTIONS;

  const optionRows = await db
    .select({
      questionId: assessmentOptions.questionId,
      optionKey: assessmentOptions.optionKey,
      letter: assessmentOptions.letter,
      label: assessmentOptions.label,
      position: assessmentOptions.position,
    })
    .from(assessmentOptions)
    .where(eq(assessmentOptions.version, version));

  return bankFromRows(questionRows, optionRows) ?? QUESTIONS;
}

/** One question as the editor sees it: candidate text plus the admin-only competency label. */
export type EditableQuestion = {
  key: string;
  position: number;
  prompt: string;
  competencyLabel: string;
  options: { key: string; letter: string; label: string }[];
};

export async function loadEditableBank(): Promise<{
  version: number;
  questions: EditableQuestion[];
}> {
  const version = await currentQuestionBankVersion();

  const questionRows = await db
    .select({
      id: assessmentQuestions.id,
      questionKey: assessmentQuestions.questionKey,
      prompt: assessmentQuestions.prompt,
      competencyLabel: assessmentQuestions.competencyLabel,
      canonicalPosition: assessmentQuestions.canonicalPosition,
    })
    .from(assessmentQuestions)
    .where(eq(assessmentQuestions.version, version))
    .orderBy(asc(assessmentQuestions.canonicalPosition));

  if (questionRows.length === 0) return { version, questions: [] };

  const optionRows = await db
    .select({
      questionId: assessmentOptions.questionId,
      optionKey: assessmentOptions.optionKey,
      letter: assessmentOptions.letter,
      label: assessmentOptions.label,
      position: assessmentOptions.position,
    })
    .from(assessmentOptions)
    .where(eq(assessmentOptions.version, version))
    .orderBy(asc(assessmentOptions.position));

  const optionsByQuestion = new Map<string, typeof optionRows>();
  for (const row of optionRows) {
    const list = optionsByQuestion.get(row.questionId);
    if (list) list.push(row);
    else optionsByQuestion.set(row.questionId, [row]);
  }

  return {
    version,
    questions: questionRows.map((question) => ({
      key: question.questionKey,
      position: question.canonicalPosition,
      prompt: question.prompt,
      competencyLabel: question.competencyLabel,
      options: (optionsByQuestion.get(question.id) ?? []).map((option) => ({
        key: option.optionKey,
        letter: option.letter,
        label: option.label,
      })),
    })),
  };
}

export type QuestionEditInput = {
  questionKey: string;
  prompt: string;
  /** Labels in letter order A-D; each lands on the option carrying that position. */
  labels: [string, string, string, string];
};

/**
 * Publishes an edit as a new version of the whole bank.
 *
 * Copy-forward, not in-place: every question, option and score row of the current version is
 * duplicated at `current + 1` with the single edited question's wording applied. The old rows are
 * never touched, which is what keeps in-flight assessments, submitted records and the CSV export
 * interpretable against the version they were pinned to. Keys, letters, positions, competencies
 * and scores are carried over verbatim — an edit changes wording, never structure.
 *
 * Completeness is enforced before anything is written: a source version missing any option score
 * would otherwise publish a bank whose answers read back with no score.
 */
export async function publishQuestionEdit(edit: QuestionEditInput): Promise<number> {
  return db.transaction(async (tx) => {
    const [head] = await tx
      .select({ version: sql<number | null>`max(${assessmentQuestions.version})::int` })
      .from(assessmentQuestions);

    const currentVersion = head?.version ?? null;
    if (currentVersion === null) {
      throw new QuestionBankError(
        "The question bank has no seeded version to copy. Run the database seed first.",
      );
    }

    const questions = await tx
      .select()
      .from(assessmentQuestions)
      .where(eq(assessmentQuestions.version, currentVersion));

    if (!questions.some((q) => q.questionKey === edit.questionKey)) {
      throw new QuestionBankError("That question is not part of the current bank.");
    }

    const options = await tx
      .select()
      .from(assessmentOptions)
      .where(eq(assessmentOptions.version, currentVersion));

    const scores = await tx
      .select()
      .from(optionScores)
      .where(inArray(optionScores.optionId, options.map((o) => o.id)));

    if (options.length === 0 || scores.length !== options.length) {
      throw new QuestionBankError(
        "The current version is missing option scores; refusing to publish a partial copy.",
      );
    }

    const newVersion = currentVersion + 1;

    const insertedQuestions = await tx
      .insert(assessmentQuestions)
      .values(
        questions.map((question) => ({
          questionKey: question.questionKey,
          version: newVersion,
          prompt: question.questionKey === edit.questionKey ? edit.prompt : question.prompt,
          competencyLabel: question.competencyLabel,
          canonicalPosition: question.canonicalPosition,
          isActive: question.isActive,
        })),
      )
      .returning({ id: assessmentQuestions.id, questionKey: assessmentQuestions.questionKey });

    const newQuestionIdByKey = new Map(insertedQuestions.map((r) => [r.questionKey, r.id]));
    const questionKeyById = new Map(questions.map((q) => [q.id, q.questionKey]));
    const scoreByOptionId = new Map(scores.map((s) => [s.optionId, s]));

    const insertedOptions = await tx
      .insert(assessmentOptions)
      .values(
        options.map((option) => {
          const questionKey = questionKeyById.get(option.questionId)!;
          return {
            questionId: newQuestionIdByKey.get(questionKey)!,
            optionKey: option.optionKey,
            version: newVersion,
            letter: option.letter,
            label:
              questionKey === edit.questionKey
                ? edit.labels[option.position - 1]!
                : option.label,
            position: option.position,
          };
        }),
      )
      .returning({ id: assessmentOptions.id, optionKey: assessmentOptions.optionKey });

    const optionIdByKey = new Map(options.map((o) => [o.optionKey, o.id]));

    await tx.insert(optionScores).values(
      insertedOptions.map((option) => {
        const score = scoreByOptionId.get(optionIdByKey.get(option.optionKey)!)!;
        return {
          optionId: option.id,
          competencyId: score.competencyId,
          score: score.score,
          evaluationNote: score.evaluationNote,
          interviewPrompt: score.interviewPrompt,
          riskFlags: score.riskFlags,
        };
      }),
    );

    return newVersion;
  });
}
