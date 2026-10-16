import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import * as schema from "../db/schema";
import { requireDatabaseUrl } from "./env";

/**
 * Applies every migration in ./drizzle in order.
 *
 * Migrations are the only route to a schema change: `drizzle-kit push` is deliberately not wired
 * into an npm script, because pushing diffs an unspecified schema straight into a live database
 * with no reviewable artifact and no rollback.
 */
async function main() {
  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15_000,
  });

  const db = drizzle(pool, { schema });

  console.log("Applying migrations from ./drizzle ...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");

  await pool.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
