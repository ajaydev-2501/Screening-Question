import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { adminSessions, adminUsers } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/crypto";
import { env, secureCookiesEnabled } from "@/lib/env";
import { DECOY_PASSWORD_HASH, hashPassword, verifyPassword } from "@/lib/password";

export { hashPassword, verifyPassword };

export const ADMIN_COOKIE = "admin_session";

/** Shorter than a candidate session: a recruiter dashboard holds every candidate's record. */
const ADMIN_TTL_HOURS = 8;
const ADMIN_TTL_SECONDS = ADMIN_TTL_HOURS * 60 * 60;

/**
 * Creates the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, and re-hashes the stored
 * password when the environment value has changed.
 *
 * Re-hashing on drift is what makes credential rotation a config edit rather than a migration:
 * without it, changing ADMIN_PASSWORD would silently do nothing and the recruiter would be locked
 * out by a value they can read in their own env file.
 */
export async function ensureAdminUser(): Promise<string> {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = env();
  const email = ADMIN_EMAIL.toLowerCase();

  const [existing] = await db
    .select({ id: adminUsers.id, passwordHash: adminUsers.passwordHash })
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (!existing) {
    const [created] = await db
      .insert(adminUsers)
      .values({ email, passwordHash: await hashPassword(ADMIN_PASSWORD) })
      .onConflictDoNothing({ target: adminUsers.email })
      .returning({ id: adminUsers.id });

    if (created) return created.id;

    const [raced] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1);
    if (!raced) throw new Error("Could not create or read the admin user.");
    return raced.id;
  }

  if (!(await verifyPassword(existing.passwordHash, ADMIN_PASSWORD))) {
    await db
      .update(adminUsers)
      .set({ passwordHash: await hashPassword(ADMIN_PASSWORD) })
      .where(eq(adminUsers.id, existing.id));
  }

  return existing.id;
}

export async function authenticateAdmin(
  email: string,
  password: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: adminUsers.id, passwordHash: adminUsers.passwordHash })
    .from(adminUsers)
    .where(eq(adminUsers.email, email.toLowerCase()))
    .limit(1);

  const ok = await verifyPassword(row?.passwordHash ?? DECOY_PASSWORD_HASH, password);
  if (!row || !ok) return null;

  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminUsers.id, row.id));

  return row.id;
}

export async function createAdminSession(
  adminId: string,
): Promise<{ token: string; sessionId: string }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ADMIN_TTL_SECONDS * 1000);

  const [row] = await db
    .insert(adminSessions)
    .values({ adminId, tokenHash: hashToken(token), expiresAt })
    .returning({ id: adminSessions.id });

  if (!row) throw new Error("Failed to create admin session");
  return { token, sessionId: row.id };
}

export async function setAdminCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: secureCookiesEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_TTL_SECONDS,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: secureCookiesEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function readAdminSession(): Promise<{
  adminId: string;
  sessionId: string;
  email: string;
} | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      adminId: adminSessions.adminId,
      sessionId: adminSessions.id,
      email: adminUsers.email,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.adminId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.tokenHash, hashToken(token)),
        isNull(adminSessions.revokedAt),
        gt(adminSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return row ? { adminId: row.adminId, sessionId: row.sessionId, email: row.email } : null;
}

/**
 * Server-side gate for every admin surface. Called from the layout and from each page and route
 * handler, because a page rendered without it would still be reachable by URL.
 */
export async function requireAdmin(): Promise<{
  adminId: string;
  sessionId: string;
  email: string;
}> {
  const session = await readAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function revokeAdminSession(sessionId: string): Promise<void> {
  await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(adminSessions.id, sessionId), isNull(adminSessions.revokedAt)));
}
