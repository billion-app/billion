CREATE TABLE "content_translation_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" varchar(20) NOT NULL,
	"content_id" uuid NOT NULL,
	"language" varchar(16) NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"segments" jsonb NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claim_id" uuid,
	CONSTRAINT "content_translation_request_contentId_language_unique" UNIQUE("content_id","language")
);
--> statement-breakpoint
ALTER TABLE "content_translation_request" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "content_translation_request_available_at_index" ON "content_translation_request" USING btree ("available_at");