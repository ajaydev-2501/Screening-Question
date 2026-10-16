import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";

import * as schema from "../db/schema";
import { sectionById, type SectionId } from "../lib/assessment/sections";
import { QUESTIONS } from "../lib/assessment/questions";
import { RUBRIC } from "../lib/assessment/rubric";
import {
  TOOL_CATALOG,
  TOOL_CATALOG_VERSION,
  TOOL_CATEGORIES,
} from "../lib/assessment/tool-catalog";
import { env } from "../lib/env";
import { hashPassword } from "../lib/password";
import { requireDatabaseUrl } from "./env";

/**
 * Seeds the question bank, the scoring rubric, the versioned tool catalog and the admin account.
 *
 * Every insert is `ON CONFLICT DO NOTHING`, so re-running the seed against a database that already
 * holds candidates is safe and cannot duplicate or overwrite an assessment in flight. Changing
 * question text is a new `version`, not an edit of this script's output: the unique indexes on
 * (question_key, version) and (option_key, version) are what let an existing candidate's stored
 * order and answers keep resolving against the wording they were made against.
 */

const CATEGORY_NAME = new Map(TOOL_CATEGORIES.map((c) => [c.key, c.name]));

/**
 * A question's section is read back from its own rubric entries rather than declared a second
 * time here. Deriving it means the seed cannot drift from the rubric; asserting that all four
 * options agree means a mis-authored rubric entry fails the seed instead of silently mislabelling
 * a question in the admin dashboard.
 */
function sectionForQuestion(questionKey: string, optionKeys: string[]): SectionId {
  const found = optionKeys.map((key) => {
    const entry = RUBRIC[key];
    if (!entry) throw new Error(`Option ${key} has no rubric entry.`);
    return entry.section;
  });

  const first = found[0]!;
  for (const id of found) {
    if (id !== first) {
      throw new Error(
        `Question ${questionKey} mixes sections (${first} and ${id}). Every option of a question must measure the same section or the per-section radar is meaningless.`,
      );
    }
  }
  return first;
}

async function main() {
  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15_000,
  });
  const db = drizzle(pool, { schema });
  const version = env().ASSESSMENT_VERSION;

  console.log(`Seeding assessment version ${version}, tool catalog version ${TOOL_CATALOG_VERSION}`);

  // --- Questions -----------------------------------------------------------
  for (const question of QUESTIONS) {
    const section = sectionForQuestion(
      question.key,
      question.options.map((o) => o.key),
    );

    await db
      .insert(schema.assessmentQuestions)
      .values({
        questionKey: question.key,
        version,
        prompt: question.prompt,
        competencyLabel: sectionById(section).shortName,
        canonicalPosition: question.position,
      })
      .onConflictDoNothing({
        target: [schema.assessmentQuestions.questionKey, schema.assessmentQuestions.version],
      });
  }
  console.log(`  questions: ${QUESTIONS.length}`);

  const questionRows = await db
    .select({ id: schema.assessmentQuestions.id, questionKey: schema.assessmentQuestions.questionKey })
    .from(schema.assessmentQuestions)
    .where(eq(schema.assessmentQuestions.version, version));
  const questionIdByKey = new Map(questionRows.map((r) => [r.questionKey, r.id]));

  // --- Options -------------------------------------------------------------
  let optionCount = 0;
  for (const question of QUESTIONS) {
    const questionId = questionIdByKey.get(question.key);
    if (!questionId) throw new Error(`Question ${question.key} was not inserted.`);

    for (const option of question.options) {
      await db
        .insert(schema.assessmentOptions)
        .values({
          questionId,
          optionKey: option.key,
          version,
          letter: option.letter,
          label: option.label,
          position: option.letter.charCodeAt(0) - "A".charCodeAt(0) + 1,
        })
        .onConflictDoNothing({
          target: [schema.assessmentOptions.optionKey, schema.assessmentOptions.version],
        });
      optionCount++;
    }
  }
  console.log(`  options: ${optionCount}`);

  const optionRows = await db
    .select({ id: schema.assessmentOptions.id, optionKey: schema.assessmentOptions.optionKey })
    .from(schema.assessmentOptions)
    .where(eq(schema.assessmentOptions.version, version));
  const optionIdByKey = new Map(optionRows.map((r) => [r.optionKey, r.id]));

  // --- Scoring rubric ------------------------------------------------------
  let scoreCount = 0;
  for (const [optionKey, entry] of Object.entries(RUBRIC)) {
    const optionId = optionIdByKey.get(optionKey);
    if (!optionId) throw new Error(`Rubric references unknown option ${optionKey}.`);

    await db
      .insert(schema.optionScores)
      .values({
        optionId,
        competencyId: entry.section,
        score: entry.score,
        evaluationNote: "",
        interviewPrompt: null,
        riskFlags: [],
      })
      .onConflictDoNothing({ target: schema.optionScores.optionId });
    scoreCount++;
  }
  console.log(`  option scores: ${scoreCount}`);

  // --- Tool catalog --------------------------------------------------------
  const positionInCategory = new Map<string, number>();
  for (const tool of TOOL_CATALOG) {
    const next = (positionInCategory.get(tool.categoryKey) ?? 0) + 1;
    positionInCategory.set(tool.categoryKey, next);

    const categoryName = CATEGORY_NAME.get(tool.categoryKey);
    if (!categoryName) {
      throw new Error(`Tool ${tool.key} references unknown category ${tool.categoryKey}.`);
    }

    await db
      .insert(schema.toolCatalog)
      .values({
        catalogVersion: TOOL_CATALOG_VERSION,
        toolKey: tool.key,
        categoryKey: tool.categoryKey,
        categoryName,
        name: tool.name,
        isOther: tool.isOther,
        position: next,
      })
      .onConflictDoNothing({
        target: [schema.toolCatalog.catalogVersion, schema.toolCatalog.toolKey],
      });
  }
  console.log(`  tools: ${TOOL_CATALOG.length} across ${TOOL_CATEGORIES.length} categories`);

  // --- Admin account -------------------------------------------------------
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = env();
  const adminEmail = ADMIN_EMAIL.toLowerCase();

  const [existingAdmin] = await db
    .select({ id: schema.adminUsers.id, passwordHash: schema.adminUsers.passwordHash })
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.email, adminEmail))
    .limit(1);

  if (existingAdmin) {
    await db
      .update(schema.adminUsers)
      .set({ passwordHash: await hashPassword(ADMIN_PASSWORD) })
      .where(eq(schema.adminUsers.id, existingAdmin.id));
    console.log(`  admin: re-hashed the password for the existing account`);
  } else {
    await db
      .insert(schema.adminUsers)
      .values({ email: adminEmail, passwordHash: await hashPassword(ADMIN_PASSWORD) })
      .onConflictDoNothing({ target: schema.adminUsers.email });
    console.log(`  admin: created the account named by ADMIN_EMAIL`);
  }

  await pool.end();
  console.log("Seed complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
