import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const assessmentStatus = pgEnum("assessment_status", [
  "in_progress",
  "submitted",
]);

/**
 * A candidate is identified by normalized email. The unique constraint here is what makes
 * "one assessment per email per version" enforceable in the database rather than in application
 * code: candidates.normalized_email is unique, and assessments is unique on
 * (candidate_id, assessment_version).
 */
export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    normalizedEmail: text("normalized_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("candidates_normalized_email_unique").on(t.normalizedEmail)],
);

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    status: assessmentStatus("status").notNull().default("in_progress"),
    /**
     * The randomized order of the 20 scored question keys, generated once when the session is
     * created and never regenerated. Question 21 (the tool inventory) is unscored and always
     * last, so it is deliberately not part of this array.
     */
    questionOrder: jsonb("question_order").$type<string[]>().notNull(),
    assessmentVersion: integer("assessment_version").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    totalScore: integer("total_score"),
    competencyScores: jsonb("competency_scores").$type<
      Record<
        string,
        { earned: number; available: number; normalized: number; weight?: number }
      >
    >(),
    /**
     * The full computed report frozen at submission: strongest and weakest sections with their
     * scores (schema 3), or, on older records, weighted competencies with follow-up suggestions
     * and risk-flagged answers (schema 2). Stored so a report stays interpretable even if the
     * rubric is revised afterwards.
     */
    resultDetail: jsonb("result_detail").$type<Record<string, unknown>>(),
    toolCatalogVersion: integer("tool_catalog_version").notNull().default(1),
  },
  (t) => [
    uniqueIndex("assessments_one_per_candidate_per_version").on(
      t.candidateId,
      t.assessmentVersion,
    ),
    index("assessments_status_idx").on(t.status),
    index("assessments_submitted_at_idx").on(t.submittedAt),
    check(
      "assessments_score_range",
      sql`total_score IS NULL OR (total_score >= 0 AND total_score <= 100)`,
    ),
  ],
);

/** The question bank. Public-safe columns only; scoring lives in optionScores. */
export const assessmentQuestions = pgTable(
  "assessment_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stable public identifier, e.g. "q01". Never changes for a given question. */
    questionKey: text("question_key").notNull(),
    version: integer("version").notNull(),
    prompt: text("prompt").notNull(),
    /** Short internal label for admin display only. Never sent to candidates. */
    competencyLabel: text("competency_label").notNull(),
    /** Canonical authored position, used for admin views; candidates see questionOrder. */
    canonicalPosition: integer("canonical_position").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("questions_key_version_unique").on(t.questionKey, t.version),
    index("questions_active_idx").on(t.isActive, t.version),
  ],
);

/** Public-safe answer options. Scoring metadata is deliberately in a separate table. */
export const assessmentOptions = pgTable(
  "assessment_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => assessmentQuestions.id, { onDelete: "cascade" }),
    /** Stable public identifier, e.g. "q01-a". */
    optionKey: text("option_key").notNull(),
    /**
     * The question-bank version this row belongs to. An edit publishes a new version (a full
     * copy-forward), never rewrites an existing row, so an answer stored against an older
     * version keeps resolving to the exact wording the candidate saw.
     */
    version: integer("version").notNull(),
    letter: text("letter").notNull(),
    label: text("label").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("options_key_version_unique").on(t.optionKey, t.version),
    uniqueIndex("options_question_letter_unique").on(t.questionId, t.letter),
  ],
);

/**
 * Server-only scoring rubric. Nothing in this table may ever be selected into a public API
 * response, rendered into HTML, or shipped in a client bundle.
 */
export const optionScores = pgTable(
  "option_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    optionId: uuid("option_id")
      .notNull()
      .references(() => assessmentOptions.id, { onDelete: "cascade" }),
    /** The section this option's question belongs to (an axis of the admin radar graph). */
    competencyId: text("competency_id").notNull(),
    /**
     * The option's proficiency level: 4 Outstanding / 3 Good / 2 Intermediate / 1 Developing on
     * current banks. Legacy rows (schema-2 era) hold the retired 0-3 scores, hence the 0 floor.
     */
    score: smallint("score").notNull(),
    /** Why this option earns this score, phrased as the engineering decision it represents. */
    evaluationNote: text("evaluation_note").notNull(),
    /** A question to ask the candidate in interview, derived from this option. */
    interviewPrompt: text("interview_prompt"),
    riskFlags: jsonb("risk_flags").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("option_scores_option_unique").on(t.optionId),
    check("option_scores_score_range", sql`score >= 0 AND score <= 4`),
  ],
);

export const assessmentAnswers = pgTable(
  "assessment_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    questionKey: text("question_key").notNull(),
    /** Null exactly when the move is a recorded skip; the check constraint below enforces it. */
    optionId: uuid("option_id").references(() => assessmentOptions.id, {
      onDelete: "restrict",
    }),
    skipped: boolean("skipped").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("answers_one_per_question").on(t.assessmentId, t.questionKey),
    index("answers_assessment_idx").on(t.assessmentId),
    check("answers_option_xor_skipped", sql`(option_id IS NULL) = skipped`),
  ],
);

/**
 * Versioned tool catalog for Question 21. Adding a tool bumps the version and inserts new rows;
 * existing selections keep pointing at the catalog revision they were made against.
 */
export const toolCatalog = pgTable(
  "tool_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    catalogVersion: integer("catalog_version").notNull(),
    /** Stable identifier, e.g. "vscode". Never changes for a given tool. */
    toolKey: text("tool_key").notNull(),
    categoryKey: text("category_key").notNull(),
    categoryName: text("category_name").notNull(),
    name: text("name").notNull(),
    /** True for the "Other ... (specify)" entry of a category, which accepts a custom name. */
    isOther: boolean("is_other").notNull().default(false),
    position: integer("position").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tool_catalog_version_key_unique").on(t.catalogVersion, t.toolKey),
    index("tool_catalog_version_category_idx").on(t.catalogVersion, t.categoryKey),
  ],
);

export const toolSelections = pgTable(
  "tool_selections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    catalogVersion: integer("catalog_version").notNull(),
    toolKey: text("tool_key").notNull(),
    customName: text("custom_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tool_selections_unique").on(t.assessmentId, t.catalogVersion, t.toolKey),
    index("tool_selections_assessment_idx").on(t.assessmentId),
  ],
);

/** The three tools the candidate credits most for their productivity, ordered. */
export const productivityTools = pgTable(
  "productivity_tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    toolKey: text("tool_key").notNull(),
    customName: text("custom_name"),
    position: integer("position").notNull(),
  },
  (t) => [
    uniqueIndex("productivity_tools_unique").on(t.assessmentId, t.toolKey),
    uniqueIndex("productivity_tools_one_per_position").on(
      t.assessmentId,
      t.position,
    ),
    check("productivity_tools_position_range", sql`position >= 1 AND position <= 3`),
  ],
);

/** Question 21 follow-up fields 2-4: primary agent, usage depth, and the real-world example. */
export const toolFollowups = pgTable(
  "tool_followups",
  {
    assessmentId: uuid("assessment_id")
      .primaryKey()
      .references(() => assessments.id, { onDelete: "cascade" }),
    // Nullable by design: this row is written on every autosave, and the candidate reaches the
    // follow-ups only after working through the tool list. Completeness is a submit-time check,
    // not a storage constraint.
    primaryAgentKey: text("primary_agent_key"),
    primaryAgentOther: text("primary_agent_other"),
    usageDepth: text("usage_depth"),
    realWorldExample: text("real_world_example"),
    /**
     * True when the candidate explicitly skipped Question 21. Only waives the follow-up
     * completeness requirement at submit time; it never deletes stored inventory content.
     */
    skipped: boolean("skipped").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const candidateSessions = pgTable(
  "candidate_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    /** SHA-256 of the high-entropy token. The raw token only ever exists in the cookie. */
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("candidate_sessions_token_hash_unique").on(t.tokenHash),
    index("candidate_sessions_assessment_idx").on(t.assessmentId),
  ],
);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("admin_users_email_unique").on(t.email)],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("admin_sessions_token_hash_unique").on(t.tokenHash)],
);

/**
 * Fixed-window rate limiting. The key is a SHA-256 hash of the action plus an opaque client
 * identifier, so raw email addresses and IP addresses are never stored in plaintext.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    action: text("action").notNull(),
    count: integer("count").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("rate_limits_window_idx").on(t.windowStart)],
);
