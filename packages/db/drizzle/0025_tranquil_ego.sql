CREATE TABLE "candidate_research_collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pilot_key" text NOT NULL,
	"source_digest" text NOT NULL,
	"document" jsonb NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"failure" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_research_editor" (
	"user_id" text PRIMARY KEY NOT NULL,
	"can_publish" boolean DEFAULT false NOT NULL,
	"granted_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_research_policy" (
	"version" text PRIMARY KEY NOT NULL,
	"approved_by" text NOT NULL,
	"statement" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "candidate_research_collection_pilot_idx" ON "candidate_research_collection" USING btree ("pilot_key","created_at");