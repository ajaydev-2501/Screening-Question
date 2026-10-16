import { NextResponse } from "next/server";

import {
  IncompleteAssessmentError,
  submitAssessment,
  UnknownAnswerError,
} from "@/lib/assessment/service";
import { clientSubject, consume, POLICY_SUBMIT } from "@/lib/rate-limit";
import { readCandidateSession, touchCandidateSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Submits and scores the assessment.
 *
 * Idempotent by construction: `submitAssessment` claims the row with a conditional update, so a
 * repeated POST — a double-click, a retry after a dropped response — returns success without
 * scoring twice. The candidate sees the same filed record either way.
 */
export async function POST() {
  const session = await readCandidateSession();
  if (!session) {
    return NextResponse.json(
      { error: "Your session has expired. Return to the start page to continue." },
      { status: 401 },
    );
  }

  const limit = await consume(POLICY_SUBMIT, await clientSubject());
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const outcome = await submitAssessment(session.assessmentId);
    await touchCandidateSession(session.sessionId);

    // The score is deliberately absent from this response. The candidate is never shown a number,
    // and a field that reached the browser once would be visible in every devtools session after.
    return NextResponse.json({
      ok: true,
      already: outcome.outcome === "already-submitted",
    });
  } catch (error) {
    if (error instanceof IncompleteAssessmentError) {
      return NextResponse.json(
        {
          error: `There are still ${error.missingQuestionKeys.length} unanswered move(s). Return to the marked moves before submitting.`,
          missing: error.missingQuestionKeys.length,
        },
        { status: 400 },
      );
    }
    if (error instanceof UnknownAnswerError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("submit-failed", { assessmentId: session.assessmentId });
    return NextResponse.json(
      { error: "Your assessment could not be submitted. Check your connection and retry." },
      { status: 500 },
    );
  }
}
