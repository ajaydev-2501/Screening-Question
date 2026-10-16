CREATE TYPE "public"."assessment_status" AS ENUM('in_progress', 'submitted');--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assessment_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"question_key" text NOT NULL,
	"option_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"option_key" text NOT NULL,
	"letter" text NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_key" text NOT NULL,
	"version" integer NOT NULL,
	"prompt" text NOT NULL,
	"competency_label" text NOT NULL,
	"canonical_position" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"status" "assessment_status" DEFAULT 'in_progress' NOT NULL,
	"question_order" jsonb NOT NULL,
	"assessment_version" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"total_score" integer,
	"competency_scores" jsonb,
	"result_detail" jsonb,
	"tool_catalog_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "assessments_score_range" CHECK (total_score IS NULL OR (total_score >= 0 AND total_score <= 100))
);
--> statement-breakpoint
CREATE TABLE "candidate_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"normalized_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option_id" uuid NOT NULL,
	"competency_id" text NOT NULL,
	"score" smallint NOT NULL,
	"evaluation_note" text NOT NULL,
	"interview_prompt" text,
	"risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "option_scores_score_range" CHECK (score >= 0 AND score <= 3)
);
--> statement-breakpoint
CREATE TABLE "productivity_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"tool_key" text NOT NULL,
	"custom_name" text,
	"position" integer NOT NULL,
	CONSTRAINT "productivity_tools_position_range" CHECK (position >= 1 AND position <= 3)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_version" integer NOT NULL,
	"tool_key" text NOT NULL,
	"category_key" text NOT NULL,
	"category_name" text NOT NULL,
	"name" text NOT NULL,
	"is_other" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_followups" (
	"assessment_id" uuid PRIMARY KEY NOT NULL,
	"primary_agent_key" text NOT NULL,
	"primary_agent_other" text,
	"usage_depth" text,
	"real_world_example" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"catalog_version" integer NOT NULL,
	"tool_key" text NOT NULL,
	"custom_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_option_id_assessment_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."assessment_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_options" ADD CONSTRAINT "assessment_options_question_id_assessment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_sessions" ADD CONSTRAINT "candidate_sessions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_scores" ADD CONSTRAINT "option_scores_option_id_assessment_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."assessment_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productivity_tools" ADD CONSTRAINT "productivity_tools_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_followups" ADD CONSTRAINT "tool_followups_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_selections" ADD CONSTRAINT "tool_selections_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_token_hash_unique" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_unique" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "answers_one_per_question" ON "assessment_answers" USING btree ("assessment_id","question_key");--> statement-breakpoint
CREATE INDEX "answers_assessment_idx" ON "assessment_answers" USING btree ("assessment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "options_key_unique" ON "assessment_options" USING btree ("option_key");--> statement-breakpoint
CREATE UNIQUE INDEX "options_question_letter_unique" ON "assessment_options" USING btree ("question_id","letter");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_key_version_unique" ON "assessment_questions" USING btree ("question_key","version");--> statement-breakpoint
CREATE INDEX "questions_active_idx" ON "assessment_questions" USING btree ("is_active","version");--> statement-breakpoint
CREATE UNIQUE INDEX "assessments_one_per_candidate_per_version" ON "assessments" USING btree ("candidate_id","assessment_version");--> statement-breakpoint
CREATE INDEX "assessments_status_idx" ON "assessments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assessments_submitted_at_idx" ON "assessments" USING btree ("submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_sessions_token_hash_unique" ON "candidate_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "candidate_sessions_assessment_idx" ON "candidate_sessions" USING btree ("assessment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidates_normalized_email_unique" ON "candidates" USING btree ("normalized_email");--> statement-breakpoint
CREATE UNIQUE INDEX "option_scores_option_unique" ON "option_scores" USING btree ("option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "productivity_tools_unique" ON "productivity_tools" USING btree ("assessment_id","tool_key");--> statement-breakpoint
CREATE UNIQUE INDEX "productivity_tools_one_per_position" ON "productivity_tools" USING btree ("assessment_id","position");--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_catalog_version_key_unique" ON "tool_catalog" USING btree ("catalog_version","tool_key");--> statement-breakpoint
CREATE INDEX "tool_catalog_version_category_idx" ON "tool_catalog" USING btree ("catalog_version","category_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_selections_unique" ON "tool_selections" USING btree ("assessment_id","catalog_version","tool_key");--> statement-breakpoint
CREATE INDEX "tool_selections_assessment_idx" ON "tool_selections" USING btree ("assessment_id");