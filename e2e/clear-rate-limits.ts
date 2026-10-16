import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * Clears the in-flight rate-limit buckets. Shared by the Playwright global setup and by any spec
 * that needs a fresh window: the suite legitimately registers more candidates than the per-client
 * session-start budget (5 / 600s) allows inside one window, and bucket rows are ephemeral counters,
 * not data. The manual escape hatch with the same effect is `npm run db:clear-rate-limits`.
 */
export async function clearRateLimits(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set; the e2e run cannot clear the rate-limit buckets.");
  }

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15_000,
  });

  await pool.query("delete from rate_limits");
  await pool.end();
}
