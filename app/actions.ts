"use server";

import { redirect } from "next/navigation";

import { TOTAL_SCREEN_COUNT } from "@/lib/assessment/questions";
import {
  firstOpenMove,
  loadAssessmentState,
  startAssessment,
} from "@/lib/assessment/service";
import { clientSubject, consume, POLICY_SESSION_START } from "@/lib/rate-limit";
import {
  clearCandidateCookie,
  createCandidateSession,
  readCandidateSession,
  revokeCandidateSession,
  setCandidateCookie,
} from "@/lib/session";
import { fieldErrors, startAssessmentSchema } from "@/lib/validation";

/**
 * The shape the entry form re-renders from. `app/actions.ts` is a `"use server"` module, which may
 * export async functions and types only, so the form owns its own idle value.
 */
export type BeginState = {
  fields: Record<string, string>;
  formError: string | null;
};

/**
 * The single message returned whenever a saved assessment cannot be handed to this browser.
 *
 * It is deliberately identical for "in progress elsewhere", "already submitted" and "no such
 * record": a candidate's cookie is the only proof of identity, and the brief forbids granting
 * access to an existing assessment merely because someone knows the email address. Splitting these
 * cases into different copy would turn the form into an oracle for which addresses have been
 * invited.
 *
 * The residual leak is that a brand-new address proceeds while a known one does not. Closing that
 * needs an out-of-band proof the candidate already controls — a magic link — which requires an
 * email provider this deployment does not have. It is recorded as a known limitation in the README.
 */
const NO_PROGRESS_HERE =
  "There is no saved progress for that address in this browser. Progress is stored in the browser you started from, so return there to continue — or contact the hiring team if you no longer have access to it.";

const RATE_LIMITED =
  "Too many attempts from this connection. Wait a few minutes and try again.";

async function beginSession(assessmentId: string): Promise<never> {
  const { token } = await createCandidateSession(assessmentId);
  await setCandidateCookie(token);

  const state = await loadAssessmentState(assessmentId);
  const move = state ? firstOpenMove(state) ?? TOTAL_SCREEN_COUNT : 1;
  redirect(`/assessment?move=${move}`);
}

export async function beginAssessment(
  _previous: BeginState,
  formData: FormData,
): Promise<BeginState> {
  const limit = await consume(POLICY_SESSION_START, await clientSubject());
  if (!limit.allowed) {
    return { fields: {}, formError: RATE_LIMITED };
  }

  const parsed = startAssessmentSchema.safeParse({
    firstName: formData.get("firstName"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { fields: fieldErrors(parsed.error), formError: null };
  }

  const result = await startAssessment(parsed.data);

  if (result.outcome === "invalid-email") {
    return {
      fields: { email: "Enter a valid email address, for example name@company.com." },
      formError: null,
    };
  }

  // A record already exists. Only a cookie this browser already holds may open it; knowing the
  // address is not enough, so every existing-record case returns the same non-confirming message.
  if (result.outcome !== "created") {
    const existing = await readCandidateSession();
    if (existing && existing.assessmentId === result.assessmentId) {
      return beginSession(result.assessmentId);
    }
    return { fields: {}, formError: NO_PROGRESS_HERE };
  }

  return beginSession(result.assessmentId);
}

export async function leaveAssessment(): Promise<void> {
  const session = await readCandidateSession();
  if (session) await revokeCandidateSession(session.sessionId);
  await clearCandidateCookie();
  redirect("/");
}
