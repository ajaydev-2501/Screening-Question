import "server-only";

import type { SectionId } from "./sections";

/**
 * The internal scoring key for all 80 answer options: one proficiency level per option.
 *
 * 4 Outstanding / 3 Good / 2 Intermediate / 1 Developing — a higher level means a more structured
 * practice. The option order in `./questions` is randomized per question, so the level cannot be
 * guessed from the letter. This table is the only place the mapping is written down. Never import
 * this module from a client component, and never include a score in a candidate-facing response.
 */

export type Proficiency = 1 | 2 | 3 | 4;

export type RubricEntry = {
  section: SectionId;
  score: Proficiency;
};

type AuthoredKeyEntry = {
  section: SectionId;
  /** The proficiency of options A, B, C, D in the order the candidate sees them. */
  scores: [Proficiency, Proficiency, Proficiency, Proficiency];
};

const AUTHORED_KEY: Record<string, AuthoredKeyEntry> = {
  q01: { section: "ai-agents", scores: [3, 2, 4, 1] },
  q02: { section: "ai-agents", scores: [2, 4, 1, 3] },
  q03: { section: "ai-agents", scores: [1, 3, 2, 4] },
  q04: { section: "ai-skills", scores: [4, 2, 3, 1] },
  q05: { section: "ai-skills", scores: [2, 1, 4, 3] },
  q06: { section: "ai-skills", scores: [3, 4, 1, 2] },
  q07: { section: "mcp-integrations", scores: [2, 1, 3, 4] },
  q08: { section: "mcp-integrations", scores: [4, 2, 1, 3] },
  q09: { section: "mcp-integrations", scores: [2, 3, 4, 1] },
  q10: { section: "dev-environment", scores: [4, 3, 1, 2] },
  q11: { section: "dev-environment", scores: [4, 2, 1, 3] },
  q12: { section: "testing-validation", scores: [2, 3, 1, 4] },
  q13: { section: "testing-validation", scores: [2, 4, 1, 3] },
  q14: { section: "testing-validation", scores: [3, 1, 4, 2] },
  q15: { section: "github-collaboration", scores: [2, 4, 1, 3] },
  q16: { section: "github-collaboration", scores: [4, 2, 3, 1] },
  q17: { section: "github-collaboration", scores: [2, 3, 4, 1] },
  q18: { section: "context-problem-solving", scores: [3, 1, 2, 4] },
  q19: { section: "context-problem-solving", scores: [2, 4, 1, 3] },
  q20: { section: "context-problem-solving", scores: [4, 2, 3, 1] },
};

const LETTERS = ["a", "b", "c", "d"] as const;

export const RUBRIC: Record<string, RubricEntry> = Object.fromEntries(
  Object.entries(AUTHORED_KEY).flatMap(([questionKey, { section, scores }]) =>
    LETTERS.map((letter, index) => [
      `${questionKey}-${letter}`,
      { section, score: scores[index]! },
    ]),
  ),
);

for (const [questionKey, { scores }] of Object.entries(AUTHORED_KEY)) {
  if (new Set(scores).size !== 4) {
    throw new Error(
      `Question ${questionKey} does not use each proficiency level exactly once (${scores.join(", ")}). The key must keep the four options distinguishable.`,
    );
  }
}
