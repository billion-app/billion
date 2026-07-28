CREATE TABLE "scraper_cursor" (
	"scraper_key" varchar(100) PRIMARY KEY NOT NULL,
	"source_updated_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
