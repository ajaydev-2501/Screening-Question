import "server-only";

import crypto from "node:crypto";

const TOKEN_BYTES = 32;

/**
 * A 256-bit URL-safe random token. Entropy is high enough that guessing a valid session token is
 * infeasible, which is what makes the cookie the sole proof of a candidate's identity.
 */
export function generateToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Session tokens are stored only as SHA-256 digests. A database leak therefore does not hand an
 * attacker a usable session, and the raw token exists only in the candidate's cookie.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Length-independent comparison for token and password-adjacent checks. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Hashes an opaque identifier (an IP address, an email) for use as a rate-limit key, so raw
 * personal data is never written to the rate_limits table.
 */
export function hashSubject(subject: string): string {
  return crypto.createHash("sha256").update(subject).digest("hex");
}

export function randomId(): string {
  return crypto.randomUUID();
}
