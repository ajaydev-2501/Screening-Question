import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { candidateSessions } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/crypto";
import { secureCookiesEnabled } from "@/lib/env";

export const CANDIDATE_COOKIE = "assessment_session";

/** Sessions live for 30 days, long enough to finish a paused assessment from the same browser. */
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

export type CandidateSession = {
  sessionId: string;
  assessmentId: string;
};

export async function createCandidateSession(
  assessmentId: string,
): Promise<{ token: string; sessionId: string }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const [row] = await db
    .insert(candidateSessions)
    .values({
      assessmentId,
      tokenHash: hashToken(token),
      expiresAt,
    })
    .returning({ id: candidateSessions.id });

  if (!row) throw new Error("Failed to create candidate session");

  return { token, sessionId: row.id };
}

export async function setCandidateCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(CANDIDATE_COOKIE, token, {
    httpOnly: true,
    secure: secureCookiesEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearCandidateCookie(): Promise<void> {
  const store = await cookies();
  store.set(CANDIDATE_COOKIE, "", {
    httpOnly: true,
    secure: secureCookiesEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Resolves the current candidate session from the cookie alone.
 *
 * No identifier is ever accepted from the request body, query string or a client component: the
 * hashed cookie is the only proof of identity, so a candidate cannot reach another candidate's
 * assessment by guessing or supplying an id.
 */
export async function readCandidateSession(): Promise<CandidateSession | null> {
  const store = await cookies();
  const token = store.get(CANDIDATE_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: candidateSessions.id,
      assessmentId: candidateSessions.assessmentId,
    })
    .from(candidateSessions)
    .where(
      and(
        eq(candidateSessions.tokenHash, hashToken(token)),
        isNull(candidateSessions.revokedAt),
        gt(candidateSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) return null;

  // Touching last_seen_at on every read would cost a write per page view; it is updated on writes
  // instead, where activity actually matters.
  return { sessionId: row.sessionId, assessmentId: row.assessmentId };
}

export async function touchCandidateSession(sessionId: string): Promise<void> {
  await db
    .update(candidateSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(candidateSessions.id, sessionId));
}

export async function revokeCandidateSession(sessionId: string): Promise<void> {
  await db
    .update(candidateSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(candidateSessions.id, sessionId), isNull(candidateSessions.revokedAt)));
}
