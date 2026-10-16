import "server-only";

import { sql } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { hashSubject } from "@/lib/crypto";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitPolicy = {
  action: string;
  limit: number;
  windowSeconds: number;
};

/** Session creation and recovery are the endpoints worth brute-forcing, so they get the tightest budget. */
export const POLICY_SESSION_START: RateLimitPolicy = {
  action: "session-start",
  limit: 5,
  windowSeconds: 600,
};

/** Answer autosave is frequent and user-driven; it needs a generous ceiling that still stops abuse. */
export const POLICY_ANSWER_WRITE: RateLimitPolicy = {
  action: "answer-write",
  limit: 240,
  windowSeconds: 600,
};

export const POLICY_ADMIN_LOGIN: RateLimitPolicy = {
  action: "admin-login",
  limit: 8,
  windowSeconds: 900,
};

export const POLICY_SUBMIT: RateLimitPolicy = {
  action: "submit",
  limit: 10,
  windowSeconds: 300,
};

/**
 * Fixed-window counter enforced atomically in the database.
 *
 * The increment happens inside a single `INSERT ... ON CONFLICT DO UPDATE`, so two simultaneous
 * requests cannot both read the same count and both slip under the limit. The window is reset in
 * the same statement, which keeps the check to one round trip.
 */
export async function consume(
  policy: RateLimitPolicy,
  subject: string,
): Promise<RateLimitResult> {
  const key = hashSubject(`${policy.action}:${subject}`);

  const result = await db.execute<{ count: number; window_start: Date }>(sql`
    INSERT INTO ${rateLimits} (key, action, count, window_start)
    VALUES (${key}, ${policy.action}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN ${rateLimits}.window_start < now() - make_interval(secs => ${policy.windowSeconds})
        THEN 1
        ELSE ${rateLimits}.count + 1
      END,
      window_start = CASE
        WHEN ${rateLimits}.window_start < now() - make_interval(secs => ${policy.windowSeconds})
        THEN now()
        ELSE ${rateLimits}.window_start
      END
    RETURNING count, window_start
  `);

  const row = Array.isArray(result) ? result[0] : result.rows[0];
  const count = Number(row?.count ?? 1);
  const windowStart = row?.window_start ? new Date(row.window_start) : new Date();

  if (count <= policy.limit) {
    return {
      allowed: true,
      remaining: policy.limit - count,
      retryAfterSeconds: 0,
    };
  }

  const elapsedMs = Date.now() - windowStart.getTime();
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((policy.windowSeconds * 1000 - elapsedMs) / 1000),
  );

  return { allowed: false, remaining: 0, retryAfterSeconds };
}

/**
 * An opaque per-client identifier for rate limiting.
 *
 * The raw address is never used as a key and never stored: it is hashed at the call site. Behind a
 * proxy the first forwarded entry is the client; in local development there is none, so the
 * fallback keeps rate limiting functional rather than silently disabled.
 */
export async function clientSubject(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const address = forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "local";
  return address;
}
