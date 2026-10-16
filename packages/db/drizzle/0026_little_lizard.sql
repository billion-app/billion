CREATE TABLE "research_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_cache" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "research_document" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"source_hash" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) STORED
);
--> statement-breakpoint
ALTER TABLE "research_document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "research_document_search_idx" ON "research_document" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "research_document_url_idx" ON "research_document" USING btree ("url");