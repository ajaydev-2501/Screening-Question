ALTER TABLE "assessment_answers" ALTER COLUMN "option_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD COLUMN "skipped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_followups" ADD COLUMN "skipped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "answers_option_xor_skipped" CHECK ((option_id IS NULL) = skipped);