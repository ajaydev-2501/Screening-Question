import { Pool } from "pg";

import { requireDatabaseUrl } from "./env";

/**
 * Clears the in-flight rate-limit buckets. The e2e suite registers several fresh candidates per
 * run, and the per-connection start limit (5 / 600s) outlives a single run, so a repeated suite
 * hits it before any test logic does. Buckets are ephemeral counters, not data.
 */
async function main() {
  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15_000,
  });

  const result = await pool.query("delete from rate_limits");
  console.log(`Cleared ${result.rowCount ?? 0} rate-limit rows.`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
