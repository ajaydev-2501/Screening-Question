import { NextResponse } from "next/server";

import {
  AssessmentNotWritableError,
  InventoryValidationError,
  saveToolInventory,
  skipInventory,
} from "@/lib/assessment/service";
import { clientSubject, consume, POLICY_ANSWER_WRITE } from "@/lib/rate-limit";
import { readCandidateSession, touchCandidateSession } from "@/lib/session";
import {
  fieldErrors,
  skipInventorySchema,
  toolInventorySchema,
} from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Autosaves the Question 21 inventory as a whole draft, or records an explicit skip of the move.
 *
 * Partial inventories are accepted on purpose: the candidate ticks tools long before they reach the
 * follow-ups. Completeness is a submit-time question, answered by `isInventoryComplete`, not a
 * save-time one.
 */
export async function POST(request: Request) {
  const session = await readCandidateSession();
  if (!session) {
    return NextResponse.json(
      { error: "Your session has expired. Return to the start page to continue." },
      { status: 401 },
    );
  }

  const limit = await consume(POLICY_ANSWER_WRITE, await clientSubject());
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many saves in a short time. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);

  // Matched before the draft schema on purpose: the draft is all-optional, so `{ skipped: true }`
  // would otherwise parse as an empty inventory and wipe everything the candidate had written.
  const skip = skipInventorySchema.safeParse(body);
  if (skip.success) {
    try {
      await skipInventory(session.assessmentId);
    } catch (error) {
      if (error instanceof AssessmentNotWritableError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      console.error("inventory-skip-failed", { assessmentId: session.assessmentId });
      return NextResponse.json(
        { error: "Your skip could not be saved. Check your connection and retry." },
        { status: 500 },
      );
    }
    await touchCandidateSession(session.sessionId);
    return NextResponse.json({ saved: true });
  }

  const parsed = toolInventorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "The inventory could not be read.", fields: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    await saveToolInventory(session.assessmentId, parsed.data);
  } catch (error) {
    if (error instanceof InventoryValidationError) {
      return NextResponse.json(
        { error: Object.values(error.fields)[0] ?? error.message, fields: error.fields },
        { status: 400 },
      );
    }
    console.error("inventory-save-failed", { assessmentId: session.assessmentId });
    return NextResponse.json(
      { error: "Your inventory could not be saved. Check your connection and retry." },
      { status: 500 },
    );
  }

  await touchCandidateSession(session.sessionId);
  return NextResponse.json({ saved: true });
}
