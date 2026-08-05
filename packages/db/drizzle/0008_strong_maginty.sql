CREATE TABLE "scraper_retry" (
	"scraper_key" varchar(100) NOT NULL,
	"item_key" varchar(100) NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"last_reason" text,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"first_failed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scraper_retry_scraper_key_item_key_pk" PRIMARY KEY("scraper_key","item_key")
);
--> statement-breakpoint
CREATE INDEX "scraper_retry_due_idx" ON "scraper_retry" USING btree ("scraper_key","next_attempt_at");