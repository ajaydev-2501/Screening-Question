import "server-only";

import { and, asc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  assessmentAnswers,
  assessmentOptions,
  assessmentQuestions,
  assessments,
  candidates,
  optionScores,
  productivityTools,
  toolCatalog,
  toolFollowups,
  toolSelections,
} from "@/db/schema";

/**
 * Read models for the hiring team.
 *
 * These are the only queries that touch `option_scores`, and they are reachable only from behind
 * `requireAdmin()`. The candidate-facing code shares no query with this module, so there is no path
 * by which a score column can reach a public response — the separation is structural, not a
 * convention about which fields to map.
 */

export type AdminStatus = "all" | "submitted" | "in_progress";
export type AdminSort = "submitted" | "score" | "name" | "activity";

export type AdminListRow = {
  id: string;
  firstName: string;
  email: string;
  status: "in_progress" | "submitted";
  startedAt: Date;
  lastActivityAt: Date;
  submittedAt: Date | null;
  totalScore: number | null;
  answeredCount: number;
  toolCount: number;
};

export type AdminListFilters = {
  status: AdminStatus;
  query: string;
  sort: AdminSort;
  direction: "asc" | "desc";
};

/** A screenful is enough for a shortlist; the CSV export carries the full list. */
const LIST_LIMIT = 200;

const ANSWER_COUNT = sql<number>`(
  select count(*)::int from ${assessmentAnswers}
  where ${assessmentAnswers.assessmentId} = ${assessments.id}
)`;

const TOOL_COUNT = sql<number>`(
  select count(*)::int from ${toolSelections}
  where ${toolSelections.assessmentId} = ${assessments.id}
)`;

export async function listAssessments(
  filters: AdminListFilters,
): Promise<AdminListRow[]> {
  const conditions = [];

  if (filters.status !== "all") {
    conditions.push(eq(assessments.status, filters.status));
  }

  const needle = escapeLike(filters.query.trim().toLowerCase());
  if (needle) {
    conditions.push(
      or(
        ilike(candidates.firstName, `%${needle}%`),
        ilike(candidates.normalizedEmail, `%${needle}%`),
      ),
    );
  }

  const rows = await db
    .select({
      id: assessments.id,
      firstName: candidates.firstName,
      email: candidates.normalizedEmail,
      status: assessments.status,
      startedAt: assessments.startedAt,
      lastActivityAt: assessments.lastActivityAt,
      submittedAt: assessments.submittedAt,
      totalScore: assessments.totalScore,
      answeredCount: ANSWER_COUNT,
      toolCount: TOOL_COUNT,
    })
    .from(assessments)
    .innerJoin(candidates, eq(assessments.candidateId, candidates.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(...orderBy(filters))
    .limit(LIST_LIMIT);

  return rows;
}

export const LIST_LIMIT_HINT = LIST_LIMIT;

/**
 * Sort keys are mapped from a closed union rather than interpolated, so the only values that ever
 * reach `sql.raw` are the ones this file itself writes.
 */
function orderBy(filters: AdminListFilters) {
  const direction = filters.direction === "asc" ? "asc" : "desc";

  switch (filters.sort) {
    case "score":
      return [
        sql`${assessments.totalScore} ${sql.raw(direction)} nulls last`,
        sql`${assessments.submittedAt} desc nulls last`,
      ];
    case "name":
      return [sql`${candidates.firstName} ${sql.raw(direction)}`];
    case "activity":
      return [sql`${assessments.lastActivityAt} ${sql.raw(direction)}`];
    case "submitted":
    default:
      return [
        sql`${assessments.submittedAt} ${sql.raw(direction)} nulls last`,
        sql`${assessments.lastActivityAt} desc`,
      ];
  }
}

export type AdminAnswerRow = {
  questionKey: string;
  position: number | null;
  prompt: string | null;
  letter: string | null;
  label: string | null;
  score: number | null;
  competencyId: string | null;
  riskFlags: string[];
  skipped: boolean;
};

export type AdminInventoryRow = {
  selections: { toolKey: string; customName: string | null }[];
  topThree: { toolKey: string; customName: string | null }[];
  primaryAgentKey: string | null;
  primaryAgentOther: string | null;
  usageDepth: string | null;
  realWorldExample: string | null;
  skipped: boolean;
};

export type AdminAssessmentDetail = {
  id: string;
  firstName: string;
  email: string;
  status: "in_progress" | "submitted";
  startedAt: Date;
  lastActivityAt: Date;
  submittedAt: Date | null;
  totalScore: number | null;
  resultDetail: StoredReport | null;
  answers: AdminAnswerRow[];
  inventory: AdminInventoryRow;
};

/** Reports filed with the retired weighted-competency model (schema 2, and bare schema 1). */
export type StoredReportV2 = {
  schema: number;
  totalScore: number;
  answeredCount: number;
  totalQuestions: number;
  /** Absent on records filed before schema 2; every record that admits skips carries it. */
  skippedCount?: number;
  competencies: {
    id: string;
    name: string;
    shortName: string;
    weight: number;
    earned: number;
    available: number;
    normalized: number;
  }[];
  strongest: string[];
  needsValidation: string[];
  followUps: {
    questionKey: string;
    optionKey: string;
    competency: string;
    competencyName: string;
    prompt: string;
    interview: string;
  }[];
  riskFindings: {
    questionKey: string;
    questionPosition: number;
    optionKey: string;
    optionLetter: string;
    prompt: string;
    answer: string;
    flags: string[];
    flagLabels: string[];
    note: string;
    interview: string;
  }[];
};

/** The section/proficiency report written from schema 3 onward. */
export type StoredReportV3 = {
  schema: number;
  totalScore: number;
  band: { id: string; label: string; min: number; max: number };
  answeredCount: number;
  totalQuestions: number;
  skippedCount?: number;
  sections: {
    id: string;
    name: string;
    shortName: string;
    earned: number;
    available: number;
    normalized: number;
  }[];
  strongest: string[];
  weakest: string[];
};

/** The frozen report written at submission. `schema` guards against a future shape change. */
export type StoredReport = StoredReportV2 | StoredReportV3;

/**
 * Distinguishes the two report families by the field that actually exists, not by a schema-number
 * comparison, so a future bump cannot silently render the wrong shape.
 */
export function isSectionReport(report: StoredReport): report is StoredReportV3 {
  return Array.isArray((report as StoredReportV3).sections);
}

export async function getAssessmentDetail(
  assessmentId: string,
): Promise<AdminAssessmentDetail | null> {
  const [row] = await db
    .select({
      id: assessments.id,
      firstName: candidates.firstName,
      email: candidates.normalizedEmail,
      status: assessments.status,
      startedAt: assessments.startedAt,
      lastActivityAt: assessments.lastActivityAt,
      submittedAt: assessments.submittedAt,
      totalScore: assessments.totalScore,
      resultDetail: assessments.resultDetail,
      toolCatalogVersion: assessments.toolCatalogVersion,
      assessmentVersion: assessments.assessmentVersion,
    })
    .from(assessments)
    .innerJoin(candidates, eq(assessments.candidateId, candidates.id))
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  if (!row) return null;

  const [answerRows, selectionRows, rankedRows, followupRows] = await Promise.all([
    db
      .select({
        questionKey: assessmentAnswers.questionKey,
        skipped: assessmentAnswers.skipped,
        position: assessmentQuestions.canonicalPosition,
        prompt: assessmentQuestions.prompt,
        letter: assessmentOptions.letter,
        label: assessmentOptions.label,
        score: optionScores.score,
        competencyId: optionScores.competencyId,
        riskFlags: optionScores.riskFlags,
      })
      .from(assessmentAnswers)
      // Left joins all the way: a skipped move has no option by design, and both joins then
      // resolve to null rather than dropping the row the way inner joins would.
      .leftJoin(assessmentOptions, eq(assessmentAnswers.optionId, assessmentOptions.id))
      .leftJoin(
        assessmentQuestions,
        and(
          eq(assessmentQuestions.questionKey, assessmentAnswers.questionKey),
          eq(assessmentQuestions.version, row.assessmentVersion),
        ),
      )
      .leftJoin(optionScores, eq(optionScores.optionId, assessmentOptions.id))
      .where(eq(assessmentAnswers.assessmentId, assessmentId))
      .orderBy(asc(assessmentQuestions.canonicalPosition)),
    db
      .select({
        toolKey: toolSelections.toolKey,
        customName: toolSelections.customName,
      })
      .from(toolSelections)
      .where(
        and(
          eq(toolSelections.assessmentId, assessmentId),
          eq(toolSelections.catalogVersion, row.toolCatalogVersion),
        ),
      ),
    db
      .select({
        toolKey: productivityTools.toolKey,
        customName: productivityTools.customName,
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
    id: row.id,
    firstName: row.firstName,
    email: row.email,
    status: row.status,
    startedAt: row.startedAt,
    lastActivityAt: row.lastActivityAt,
    submittedAt: row.submittedAt,
    totalScore: row.totalScore,
    resultDetail: (row.resultDetail as StoredReport | null) ?? null,
    answers: answerRows.map((answer) => ({
      ...answer,
      riskFlags: answer.riskFlags ?? [],
    })),
    inventory: {
      selections: selectionRows,
      topThree: rankedRows,
      primaryAgentKey: followup?.primaryAgentKey ?? null,
      primaryAgentOther: followup?.primaryAgentOther ?? null,
      usageDepth: followup?.usageDepth ?? null,
      realWorldExample: followup?.realWorldExample ?? null,
      skipped: followup?.skipped ?? false,
    },
  };
}

/**
 * Every submitted record, with the columns the spreadsheet export needs.
 *
 * The aggregates are computed in the database rather than by looping in application code: the
 * export exists to be opened in a spreadsheet, and a few hundred rows each carrying 319 tool names
 * should never cross the wire as objects first.
 */
export type AdminExportRow = {
  firstName: string;
  email: string;
  status: "in_progress" | "submitted";
  startedAt: Date;
  submittedAt: Date | null;
  totalScore: number | null;
  competencyScores: Record<string, { normalized: number }> | null;
  resultDetail: StoredReport | null;
  tools: string | null;
  topThree: string | null;
  primaryAgentKey: string | null;
  primaryAgentOther: string | null;
  usageDepth: string | null;
  realWorldExample: string | null;
};

export async function listForExport(): Promise<AdminExportRow[]> {
  return db
    .select({
      firstName: candidates.firstName,
      email: candidates.normalizedEmail,
      status: assessments.status,
      startedAt: assessments.startedAt,
      submittedAt: assessments.submittedAt,
      totalScore: assessments.totalScore,
      competencyScores: assessments.competencyScores,
      resultDetail: sql<StoredReport | null>`${assessments.resultDetail}`,
      tools: sql<string | null>`(
        select string_agg(
          coalesce(${toolSelections.customName}, ${toolCatalog.name}),
          ', ' order by ${toolCatalog.position}
        )
        from ${toolSelections}
        join ${toolCatalog}
          on ${toolCatalog.toolKey} = ${toolSelections.toolKey}
         and ${toolCatalog.catalogVersion} = ${toolSelections.catalogVersion}
        where ${toolSelections.assessmentId} = ${assessments.id}
      )`,
      topThree: sql<string | null>`(
        select string_agg(
          coalesce(${productivityTools.customName}, ${toolCatalog.name}),
          ' | ' order by ${productivityTools.position}
        )
        from ${productivityTools}
        join ${toolCatalog}
          on ${toolCatalog.toolKey} = ${productivityTools.toolKey}
         and ${toolCatalog.catalogVersion} = ${assessments.toolCatalogVersion}
        where ${productivityTools.assessmentId} = ${assessments.id}
      )`,
      primaryAgentKey: toolFollowups.primaryAgentKey,
      primaryAgentOther: toolFollowups.primaryAgentOther,
      usageDepth: toolFollowups.usageDepth,
      realWorldExample: toolFollowups.realWorldExample,
    })
    .from(assessments)
    .innerJoin(candidates, eq(assessments.candidateId, candidates.id))
    .leftJoin(toolFollowups, eq(toolFollowups.assessmentId, assessments.id))
    .orderBy(sql`${assessments.submittedAt} desc nulls last`);
}

/**
 * LIKE treats `%` and `_` as wildcards, so a recruiter searching for an underscore would otherwise
 * match every record. The backslash is LIKE's default escape character.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
