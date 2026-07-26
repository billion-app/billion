CREATE TABLE "content_brief" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" varchar(20) NOT NULL,
	"content_id" uuid NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"brief" jsonb NOT NULL,
	"model_version" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "content_brief_contentType_contentId_unique" UNIQUE("content_type","content_id")
);
--> statement-breakpoint
CREATE INDEX "content_brief_content_id_idx" ON "content_brief" USING btree ("content_id");