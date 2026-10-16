import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and provide the Neon connection string.",
  );
}

declare global {
  var __assessmentPgPool: Pool | undefined;
}

function createPool(): Pool {
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: true },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

const pool = globalThis.__assessmentPgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__assessmentPgPool = pool;
}

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

export type Database = typeof db;
