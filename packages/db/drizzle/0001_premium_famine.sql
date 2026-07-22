CREATE EXTENSION IF NOT EXISTS "pg_trgm";
--> statement-breakpoint
CREATE TABLE "content_lens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" varchar(20) NOT NULL,
	"content_id" uuid NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"lens_data" jsonb NOT NULL,
	"model_version" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "content_lens_contentType_contentId_unique" UNIQUE("content_type","content_id")
);
--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS ((
        setweight(to_tsvector('english', coalesce(bill_number, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(sponsor, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(full_text, '')), 'C')
      )) STORED;--> statement-breakpoint
ALTER TABLE "court_case" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS ((
        setweight(to_tsvector('english', coalesce(case_number, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(full_text, '')), 'C')
      )) STORED;--> statement-breakpoint
ALTER TABLE "government_content" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS ((
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(full_text, '')), 'C')
      )) STORED;--> statement-breakpoint
CREATE INDEX "content_lens_content_id_idx" ON "content_lens" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "bill_search_vector_idx" ON "bill" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "bill_number_trgm_idx" ON "bill" USING gin ("bill_number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "court_case_search_vector_idx" ON "court_case" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "court_case_number_trgm_idx" ON "court_case" USING gin ("case_number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "government_content_search_vector_idx" ON "government_content" USING gin ("search_vector");
