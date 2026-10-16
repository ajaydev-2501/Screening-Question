import type { Question } from "@/lib/assessment/questions";
import { SCORED_QUESTION_COUNT, TOTAL_SCREEN_COUNT } from "@/lib/assessment/questions";

/**
 * The shapes that cross between the server and the candidate's browser.
 *
 * These live apart from `./service` on purpose. `service.ts` is `server-only` because it reaches
 * the database and the rubric; a client component that needed one of these types would fail the
 * build importing it from there. Keeping the public-safe shapes in their own module makes the
 * boundary a file, not a convention.
 *
 * Nothing in here carries a score, a competency, an evaluation note or an interview prompt.
 */

/**
 * One screen of the candidate flow. Moves 1-20 are the scored questions in the candidate's own
 * persisted random order; move 21 is always the unscored tool inventory.
 */
export type Screen =
  | { kind: "question"; index: number; move: number; question: Question }
  | { kind: "inventory"; index: number; move: number };

export type ToolInventoryState = {
  catalogVersion: number;
  selections: { toolKey: string; customName: string | null }[];
  productivityTools: { toolKey: string; customName: string | null }[];
  primaryAgentKey: string | null;
  primaryAgentOther: string | null;
  usageDepthKey: string | null;
  realWorldExample: string | null;
  /** True when the candidate declined Question 21; it waives the follow-up requirement. */
  skipped: boolean;
};

/** Everything a candidate-facing screen may see. */
export type AssessmentState = {
  assessmentId: string;
  firstName: string;
  status: "in_progress" | "submitted";
  submittedAt: Date | null;
  screens: Screen[];
  answers: Record<string, string>;
  /** Scored moves the candidate explicitly skipped, in the candidate's own move order. */
  skippedKeys: string[];
  answeredCount: number;
  inventory: ToolInventoryState;
};

export const SCORED_COUNT = SCORED_QUESTION_COUNT;
export const SCREEN_TOTAL = TOTAL_SCREEN_COUNT;

export function emptyInventory(catalogVersion: number): ToolInventoryState {
  return {
    catalogVersion,
    selections: [],
    productivityTools: [],
    primaryAgentKey: null,
    primaryAgentOther: null,
    usageDepthKey: null,
    realWorldExample: null,
    skipped: false,
  };
}
