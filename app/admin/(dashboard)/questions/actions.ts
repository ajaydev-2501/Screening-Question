"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-auth";
import {
  publishQuestionEdit,
  QuestionBankError,
} from "@/lib/assessment/question-bank";
import { fieldErrors, questionEditSchema } from "@/lib/validation";

export type QuestionEditState = {
  fields: Record<string, string>;
  formError: string | null;
  /** The version the edit was published as, or null when the save did not go through. */
  publishedVersion: number | null;
};

/**
 * Publishes an edit to one question's wording as a new bank version.
 *
 * The write is copy-forward inside `publishQuestionEdit`, so this action never mutates a row an
 * in-flight candidate renders from. Admin-only: `requireAdmin` redirects an expired session before
 * anything is parsed or written.
 */
export async function saveQuestionEdit(
  _previous: QuestionEditState,
  formData: FormData,
): Promise<QuestionEditState> {
  await requireAdmin();

  const parsed = questionEditSchema.safeParse({
    questionKey: formData.get("questionKey"),
    prompt: formData.get("prompt"),
    label_a: formData.get("label_a"),
    label_b: formData.get("label_b"),
    label_c: formData.get("label_c"),
    label_d: formData.get("label_d"),
  });

  if (!parsed.success) {
    return { fields: fieldErrors(parsed.error), formError: null, publishedVersion: null };
  }

  try {
    const publishedVersion = await publishQuestionEdit({
      questionKey: parsed.data.questionKey,
      prompt: parsed.data.prompt,
      labels: [
        parsed.data.label_a,
        parsed.data.label_b,
        parsed.data.label_c,
        parsed.data.label_d,
      ],
    });

    revalidatePath("/admin/questions");
    return { fields: {}, formError: null, publishedVersion };
  } catch (error) {
    // The bank's own refusals (unseeded bank, unknown key, partial score copy) carry messages
    // written for an administrator; anything else is a real fault and belongs in the error log.
    if (error instanceof QuestionBankError) {
      return { fields: {}, formError: error.message, publishedVersion: null };
    }
    throw error;
  }
}
