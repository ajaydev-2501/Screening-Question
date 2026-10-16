import "server-only";

import { QUESTIONS, type Question } from "./questions";
import { RUBRIC, type Proficiency } from "./rubric";
import { SECTIONS, type SectionId } from "./sections";

/**
 * The published screening bands for the raw 20-80 total. These are the client's preliminary
 * screening bands, not validated benchmarks, and they are shown to the admin only.
 */
export const ASSESSMENT_BANDS = [
  { id: "strong", label: "Strong reported workflow maturity", min: 68, max: 80 },
  { id: "good", label: "Good reported workflow maturity", min: 52, max: 67 },
  { id: "intermediate", label: "Intermediate reported workflow maturity", min: 36, max: 51 },
  { id: "developing", label: "Developing reported workflow maturity", min: 20, max: 35 },
] as const satisfies readonly {
  id: string;
  label: string;
  min: number;
  max: number;
}[];

export type Band = (typeof ASSESSMENT_BANDS)[number];

export type BandId = Band["id"];

export function bandForScore(total: number): Band {
  const band = ASSESSMENT_BANDS.find((b) => total >= b.min && total <= b.max);
  if (!band) {
    throw new Error(
      `Total score ${total} falls outside every screening band (20-80). A band table without full coverage would mislabel records.`,
    );
  }
  return band;
}

export type SectionResult = {
  id: SectionId;
  name: string;
  shortName: string;
  earned: number;
  available: number;
  /** 0-100 within this section, from its own earned/available points. */
  normalized: number;
};

export type AssessmentResult = {
  /** Raw sum of the twenty proficiency levels, 20-80. */
  totalScore: number;
  band: Band;
  sections: SectionResult[];
  strongest: SectionResult[];
  weakest: SectionResult[];
  answeredCount: number;
  totalQuestions: number;
  /** Moves the candidate explicitly declined; each earns the 1-point floor and counts as skipped. */
  skippedCount: number;
};

const MAX_QUESTION_SCORE = 4;

/**
 * A skipped move scores the Developing floor (1 of 4). Every record then lands inside the
 * published 20-80 bands, and a skip reads as the weakest option — never as a hole in the total.
 */
const SKIP_SCORE: Proficiency = 1;

export class IncompleteAssessmentError extends Error {
  readonly missingQuestionKeys: string[];

  constructor(missingQuestionKeys: string[]) {
    super(
      `Assessment is missing ${missingQuestionKeys.length} answer(s): ${missingQuestionKeys.join(", ")}`,
    );
    this.name = "IncompleteAssessmentError";
    this.missingQuestionKeys = missingQuestionKeys;
  }
}

/**
 * Computes the assessment result from a candidate's answers.
 *
 * The total is the raw sum of the chosen options' proficiency levels (1-4 each), so the score
 * matches the published bands without any weighting. Sections exist for the admin radar graph:
 * each is normalized to 0-100 from its own points, so the two-question LSP section compares
 * fairly against the three-question sections. The strongest and weakest lists name every section
 * tied at the top or bottom of that ranking.
 *
 * Explicitly skipped moves must be passed in `skipped`. A move that is neither answered nor
 * skipped fails the completeness check — nothing else does.
 *
 * `questions` defaults to the module bank but callers should pass the assessment's pinned version:
 * keys are stable across versions, but attributing a question to its section must use the bank the
 * candidate was actually shown.
 */
export function scoreAssessment(
  answers: ReadonlyMap<string, string>,
  skipped: ReadonlySet<string> = new Set(),
  questions: readonly Question[] = QUESTIONS,
): AssessmentResult {
  const missing = questions
    .filter((q) => !answers.has(q.key) && !skipped.has(q.key))
    .map((q) => q.key);
  if (missing.length > 0) {
    throw new IncompleteAssessmentError(missing);
  }

  const tally = new Map<SectionId, { earned: number; available: number }>(
    SECTIONS.map((s) => [s.id, { earned: 0, available: 0 }]),
  );

  let skippedCount = 0;

  for (const question of questions) {
    // Attribution comes from the question's first option: every option of a question belongs to
    // one section, so the choice only decides the points, never the bucket.
    const first = question.options[0];
    const firstEntry = first ? RUBRIC[first.key] : undefined;
    const bucket = firstEntry ? tally.get(firstEntry.section) : undefined;
    if (!firstEntry || !bucket) {
      throw new Error(
        `Question ${question.key} has no scorable option to attribute to a section.`,
      );
    }
    bucket.available += MAX_QUESTION_SCORE;

    const optionKey = answers.get(question.key);

    if (!optionKey) {
      bucket.earned += SKIP_SCORE;
      skippedCount += 1;
      continue;
    }

    const entry = RUBRIC[optionKey];
    if (!entry) {
      throw new Error(
        `Option ${optionKey} has no scoring record. Every option must have a rubric entry.`,
      );
    }

    const option = question.options.find((o) => o.key === optionKey);
    if (!option) {
      throw new Error(`Option key ${optionKey} is not in the question bank`);
    }

    bucket.earned += entry.score;
  }

  const sections: SectionResult[] = SECTIONS.map((s) => {
    const bucket = tally.get(s.id) ?? { earned: 0, available: 0 };
    const normalized =
      bucket.available === 0
        ? 0
        : Math.round((bucket.earned / bucket.available) * 100);
    return {
      id: s.id,
      name: s.name,
      shortName: s.shortName,
      earned: bucket.earned,
      available: bucket.available,
      normalized,
    };
  });

  const totalScore = sections.reduce((sum, s) => sum + s.earned, 0);

  const ranked = [...sections].sort((a, b) => b.normalized - a.normalized);
  const top = ranked[0]!.normalized;
  const bottom = ranked[ranked.length - 1]!.normalized;

  return {
    totalScore,
    band: bandForScore(totalScore),
    sections,
    strongest: sections.filter((s) => s.normalized === top),
    weakest: sections.filter((s) => s.normalized === bottom),
    answeredCount: answers.size,
    totalQuestions: questions.length,
    skippedCount,
  };
}

/**
 * A plain-object shape safe to persist as JSONB and to render in the admin dashboard.
 * Kept separate from AssessmentResult so the stored record is explicit about its own shape.
 */
export function serializeSectionScores(result: AssessmentResult) {
  return Object.fromEntries(
    result.sections.map((s) => [
      s.id,
      {
        earned: s.earned,
        available: s.available,
        normalized: s.normalized,
      },
    ]),
  );
}
