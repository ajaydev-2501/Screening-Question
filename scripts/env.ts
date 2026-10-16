import { config as loadEnv } from "dotenv";

/**
 * Next.js loads `.env.local` on its own; standalone `tsx`/`node` entrypoints do not, so the
 * scripts load it explicitly. `.env` is read second so it can supply defaults without overriding
 * a local secret.
 */
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill in the Neon connection string.",
    );
  }
  return url;
}
