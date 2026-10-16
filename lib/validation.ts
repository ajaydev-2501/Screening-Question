import { z } from "zod";

import { MAX_PRODUCTIVITY_TOOLS } from "@/lib/assessment/tool-inventory";

/**
 * Every write from the browser is parsed here before it touches the database.
 *
 * Two rules shape these schemas. Unknown keys are stripped rather than accepted, so a stale client
 * tab cannot persist a field this version does not know about. And nothing trusts a length: every
 * free-text field carries an explicit maximum, because an unbounded `text` column behind a public
 * endpoint is a storage-exhaustion vector.
 */

export const MAX_FIRST_NAME_LENGTH = 80;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_CUSTOM_TOOL_NAME_LENGTH = 120;
export const MAX_PRIMARY_AGENT_OTHER_LENGTH = 120;
/** The longest authored prompt is ~220 characters; the ceiling only has to sit above that. */
export const MAX_QUESTION_PROMPT_LENGTH = 600;
/** The longest authored option label is ~200 characters; the ceiling only has to sit above that. */
export const MAX_OPTION_LABEL_LENGTH = 500;
/** The catalog holds 319 tools; the ceiling only has to sit above that and well below abusive. */
export const MAX_TOOL_SELECTIONS = 400;
export const MAX_REAL_WORLD_EXAMPLE_LENGTH = 2000;

export const startAssessmentSchema = z.object({
  firstName: z.string().trim().min(1).max(MAX_FIRST_NAME_LENGTH),
  email: z.string().trim().min(3).max(MAX_EMAIL_LENGTH),
});

const scoredQuestionKey = z.string().regex(/^q(0[1-9]|1[0-9]|20)$/);
const scoredOptionKey = z.string().regex(/^q(0[1-9]|1[0-9]|20)-[a-d]$/);

/**
 * One scored move: either a chosen option, or an explicit skip.
 *
 * A union of two exact shapes rather than optional fields, so a body carrying both — or neither —
 * is rejected outright instead of resolved by precedence. When both are present the option branch
 * wins and the skip is stripped, which is the safe reading: a tampered payload cannot turn a
 * recorded answer into a skip.
 */
export const saveAnswerSchema = z.union([
  z.object({
    questionKey: scoredQuestionKey,
    optionKey: scoredOptionKey,
  }),
  z.object({
    questionKey: scoredQuestionKey,
    skipped: z.literal(true),
  }),
]);

/**
 * The Question 21 skip body. Matched before `toolInventorySchema` in the route on purpose: the
 * draft schema is all-optional by design, so `{ skipped: true }` would otherwise parse as an empty
 * inventory and wipe everything the candidate had already written.
 */
export const skipInventorySchema = z.object({ skipped: z.literal(true) });

/** A trimmed free-text field that folds "" to null, so "cleared" and "never filled" store alike. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null));

/** One checked tool in the inventory, plus its custom name when the entry is an "Other". */
export const toolSelectionSchema = z.object({
  toolKey: z.string().trim().min(1).max(120),
  customName: optionalText(MAX_CUSTOM_TOOL_NAME_LENGTH),
});

const productivityToolSchema = z.object({
  toolKey: z.string().trim().min(1).max(120),
  customName: optionalText(MAX_CUSTOM_TOOL_NAME_LENGTH),
});

/**
 * The Question 21 draft.
 *
 * Every follow-up is nullable because this schema guards an autosave, not the submission. The
 * candidate ticks tools for a while before they reach the follow-ups at all, and an autosave that
 * rejected a half-filled inventory would quietly stop saving — the worst possible failure for a
 * form that promises "progress saved automatically". Completeness is enforced where refusing is
 * correct: at submit time, by `isInventoryComplete`.
 */
export const toolInventorySchema = z.object({
  selections: z.array(toolSelectionSchema).max(MAX_TOOL_SELECTIONS).default([]),
  productivityTools: z
    .array(productivityToolSchema)
    .max(MAX_PRODUCTIVITY_TOOLS)
    .default([]),
  primaryAgentKey: optionalText(60),
  primaryAgentOther: optionalText(MAX_PRIMARY_AGENT_OTHER_LENGTH),
  usageDepthKey: optionalText(60),
  realWorldExample: optionalText(MAX_REAL_WORLD_EXAMPLE_LENGTH),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().min(3).max(MAX_EMAIL_LENGTH),
  password: z.string().min(1).max(200),
});

/**
 * One published edit to a question's wording: the prompt and its four option labels.
 *
 * Letters are addressed by name (`label_a`..`label_d`) rather than by position so a renamed or
 * reordered option cannot silently receive the wrong label — the admin action maps them onto
 * positions in letter order.
 */
export const questionEditSchema = z.object({
  questionKey: scoredQuestionKey,
  prompt: z
    .string()
    .trim()
    .min(1, "The prompt cannot be empty.")
    .max(
      MAX_QUESTION_PROMPT_LENGTH,
      `Keep the prompt under ${MAX_QUESTION_PROMPT_LENGTH} characters.`,
    ),
  label_a: z
    .string()
    .trim()
    .min(1, "Option A needs a label.")
    .max(MAX_OPTION_LABEL_LENGTH, `Keep labels under ${MAX_OPTION_LABEL_LENGTH} characters.`),
  label_b: z
    .string()
    .trim()
    .min(1, "Option B needs a label.")
    .max(MAX_OPTION_LABEL_LENGTH, `Keep labels under ${MAX_OPTION_LABEL_LENGTH} characters.`),
  label_c: z
    .string()
    .trim()
    .min(1, "Option C needs a label.")
    .max(MAX_OPTION_LABEL_LENGTH, `Keep labels under ${MAX_OPTION_LABEL_LENGTH} characters.`),
  label_d: z
    .string()
    .trim()
    .min(1, "Option D needs a label.")
    .max(MAX_OPTION_LABEL_LENGTH, `Keep labels under ${MAX_OPTION_LABEL_LENGTH} characters.`),
});

export type StartAssessmentInput = z.infer<typeof startAssessmentSchema>;
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
export type ToolInventoryInput = z.infer<typeof toolInventorySchema>;
export type ToolSelectionInput = z.infer<typeof toolSelectionSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type QuestionEditFields = z.infer<typeof questionEditSchema>;

/**
 * Flattens a ZodError into the first message per field, which is what the forms render.
 *
 * Only the first problem per field survives: a form showing four complaints about one input reads
 * as the form arguing rather than as it helping.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    if (!(path in out)) out[path] = issue.message;
  }
  return out;
}
