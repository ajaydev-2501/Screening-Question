import { NextResponse } from "next/server";

import {
  AssessmentNotWritableError,
  saveAnswer,
  skipAnswer,
  UnknownAnswerError,
} from "@/lib/assessment/service";
import { clientSubject, consume, POLICY_ANSWER_WRITE } from "@/lib/rate-limit";
import { readCandidateSession, touchCandidateSession } from "@/lib/session";
import { fieldErrors, saveAnswerSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Autosaves one answer, or records an explicit skip of one scored move.
 *
 * The assessment is resolved from the session cookie alone. No assessment id, candidate id or
 * question id is accepted from the request body, so this endpoint cannot be pointed at another
 * candidate's record by editing a payload.
 */
export async function POST(request: Request) {
  const session = await readCandidateSession();
  if (!session) {
    return NextResponse.json({ error: "Your session has expired. Return to the start page to continue." }, { status: 401 });
  }

  const limit = await consume(POLICY_ANSWER_WRITE, await clientSubject());
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many saves in a short time. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = saveAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "That answer could not be read.", fields: fieldErrors(parsed.error) }, { status: 400 });
  }

  try {
    if ("skipped" in parsed.data) {
      await skipAnswer(session.assessmentId, parsed.data.questionKey);
    } else {
      await saveAnswer(session.assessmentId, parsed.data.questionKey, parsed.data.optionKey);
    }
  } catch (error) {
    if (error instanceof AssessmentNotWritableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof UnknownAnswerError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // The detail is logged, never returned: a database error reaching the browser is a map of the
    // schema for anyone probing the endpoint.
    console.error("answer-save-failed", { assessmentId: session.assessmentId });
    return NextResponse.json(
      { error: "Your answer could not be saved. Check your connection and retry." },
      { status: 500 },
    );
  }

  await touchCandidateSession(session.sessionId);
  return NextResponse.json({ saved: true });
}
