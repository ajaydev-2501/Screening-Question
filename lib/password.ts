import "server-only";

import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id at OWASP's floor for password hashing.
 *
 * The parameters are explicit rather than library defaults so a dependency bump cannot silently
 * weaken every hash written after it, and so the seed script and the runtime auth path are
 * guaranteed to agree — a hash written with one set of parameters cannot be verified with another.
 */
export const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

/**
 * A real argon2id digest of a plaintext that was generated randomly and discarded, so it can never
 * be verified against. Callers verify a submitted password against this when the account does not
 * exist: without it a wrong email returns in microseconds while a right email costs ~100ms of key
 * derivation, which turns the login form into an account-enumeration oracle.
 */
export const DECOY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$8m/F7H3OucG+gvpQI6QdLQ$kO13eMs69pYsy44ISyzb9fM7fmOkmotCNayl3fiErKY";

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, { ...ARGON2_OPTIONS });
}

export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
