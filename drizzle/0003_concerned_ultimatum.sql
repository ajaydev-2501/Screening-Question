DROP INDEX "options_key_unique";--> statement-breakpoint
ALTER TABLE "assessment_options" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE "assessment_options"
  SET "version" = "assessment_questions"."version"
  FROM "assessment_questions"
  WHERE "assessment_questions"."id" = "assessment_options"."question_id";--> statement-breakpoint
ALTER TABLE "assessment_options" ALTER COLUMN "version" DROP DEFAULT;--> statement-breakpoint
CREATE UNIQUE INDEX "options_key_version_unique" ON "assessment_options" USING btree ("option_key","version");
