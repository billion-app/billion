CREATE TABLE "content_translation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" varchar(20) NOT NULL,
	"content_id" uuid NOT NULL,
	"language" varchar(16) NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"model_version" varchar(80) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "content_translation_contentId_language_unique" UNIQUE("content_id","language")
);
