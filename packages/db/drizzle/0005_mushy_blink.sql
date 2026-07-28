CREATE TABLE "bill_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"analysis" jsonb NOT NULL,
	"analysis_version" integer NOT NULL,
	"model_version" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "bill_analysis_contentId_unique" UNIQUE("content_id")
);
--> statement-breakpoint
CREATE INDEX "bill_analysis_content_id_idx" ON "bill_analysis" USING btree ("content_id");