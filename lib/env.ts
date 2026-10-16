import "server-only";

import { z } from "zod";

const hexKey = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "must be 64 lowercase hex characters (32 bytes)");

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection URL"),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email address"),
  ADMIN_PASSWORD: z
    .string()
    .min(12, "ADMIN_PASSWORD must be at least 12 characters")
    .max(200),
  SESSION_SIGNING_KEY: hexKey,
  ASSESSMENT_VERSION: z.coerce.number().int().positive().default(1),
  TOOL_CATALOG_VERSION: z.coerce.number().int().positive().default(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env.local and fill in real values.`,
    );
  }

  if (parsed.data.NODE_ENV === "production") {
    if (parsed.data.ADMIN_EMAIL === "recruiter@example.com") {
      throw new Error(
        "ADMIN_EMAIL is still the placeholder value. Set a real recruiter address before deploying.",
      );
    }
    if (parsed.data.SESSION_SIGNING_KEY === "0".repeat(64)) {
      throw new Error(
        "SESSION_SIGNING_KEY is still the placeholder value. Generate a real key before deploying.",
      );
    }
  }

  cached = parsed.data;
  return cached;
}

/** True when cookies must be marked Secure, i.e. anywhere the app is served over HTTPS. */
export function secureCookiesEnabled(): boolean {
  return env().NODE_ENV === "production";
}
