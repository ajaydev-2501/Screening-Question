import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The rubric boundary is structural, not conventional: candidate-facing modules must not even
 * import the scoring modules, and no client component may reach a server-only module. Next fails
 * the build on most violations, but these checks run in milliseconds and name the offending file.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Modules that must open with the server-only guard. */
const SERVER_ONLY_MODULES = [
  "lib/assessment/rubric.ts",
  "lib/assessment/scoring.ts",
  "lib/assessment/sections.ts",
  "lib/assessment/service.ts",
  "lib/assessment/question-bank.ts",
  "lib/admin-auth.ts",
  "lib/admin/queries.ts",
  "lib/crypto.ts",
  "lib/password.ts",
  "lib/session.ts",
  "lib/rate-limit.ts",
  "lib/env.ts",
];

/** Candidate-facing modules that ship to the browser; they may not import any of the above. */
const PUBLIC_MODULES = [
  "lib/assessment/questions.ts",
  "lib/assessment/tool-inventory.ts",
  "lib/assessment/tool-catalog.ts",
  "lib/assessment/service-types.ts",
  "lib/validation.ts",
  "lib/email.ts",
  "lib/format.ts",
];

/** Import specifiers that drag scoring internals, database access, or auth server-side. */
const FORBIDDEN_SPECIFIERS = [
  "server-only",
  "@/db",
  "@/lib/assessment/rubric",
  "@/lib/assessment/scoring",
  "@/lib/assessment/sections",
  "@/lib/assessment/service",
  "@/lib/assessment/question-bank",
  "@/lib/admin-auth",
  "@/lib/admin/queries",
  "@/lib/crypto",
  "@/lib/session",
  "@/lib/password",
  "@/lib/rate-limit",
  "@/lib/env",
];

function isForbidden(specifier: string): boolean {
  return FORBIDDEN_SPECIFIERS.some(
    (forbidden) => specifier === forbidden || specifier.startsWith(`${forbidden}/`),
  );
}

function importsOf(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(/\bfrom\s*["']([^"']+)["']/g)) {
    specifiers.push(match[1]!);
  }
  for (const match of source.matchAll(/\bimport\s*["']([^"']+)["']/g)) {
    specifiers.push(match[1]!);
  }
  return specifiers;
}

function isClientComponent(source: string): boolean {
  const head = source.trimStart();
  return head.startsWith('"use client"') || head.startsWith("'use client'");
}

/** Comments may name what the code is free of; only executable text is checked. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .map((entry) => entry.replaceAll("\\", "/"))
    .filter((entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"))
    .map((entry) => path.join(dir, entry));
}

const UI_FILES = [
  ...sourceFiles("app"),
  ...sourceFiles("components"),
  ...sourceFiles("lib"),
];
const CLIENT_FILES = UI_FILES.filter((file) => isClientComponent(readFileSync(path.join(ROOT, file), "utf8")));

describe("server-only boundary", () => {
  it("finds the project's source files, so a broken scan cannot pass silently", () => {
    expect(UI_FILES.length).toBeGreaterThan(30);
    expect(CLIENT_FILES.length).toBeGreaterThanOrEqual(5);
  });

  it("guards every sensitive module with the server-only import", () => {
    for (const file of SERVER_ONLY_MODULES) {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      expect(source.startsWith('import "server-only";'), file).toBe(true);
    }
  });

  it("keeps every 'use client' file away from server-only modules", () => {
    for (const file of CLIENT_FILES) {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      for (const specifier of importsOf(source)) {
        expect(isForbidden(specifier), `${file} imports ${specifier}`).toBe(false);
      }
    }
  });

  it("keeps the candidate-facing modules ignorant of the rubric and the database", () => {
    for (const file of PUBLIC_MODULES) {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      expect(source.startsWith('import "server-only";'), file).toBe(false);
      for (const specifier of importsOf(source)) {
        expect(isForbidden(specifier), `${file} imports ${specifier}`).toBe(false);
      }
    }
  });

  it("keeps the public question module free of scoring vocabulary", () => {
    const source = readFileSync(path.join(ROOT, "lib/assessment/questions.ts"), "utf8");
    expect(withoutComments(source)).not.toMatch(/\bscore\b|\bcompetency\b|\brubric\b|\bweight\b/i);
  });
});
