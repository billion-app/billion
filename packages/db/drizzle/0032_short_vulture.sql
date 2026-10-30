CREATE TABLE "california_race_work" (
	"key" text PRIMARY KEY NOT NULL,
	"snapshot_id" text NOT NULL,
	"race_key" text NOT NULL,
	"roster_digest" text NOT NULL,
	"policy_version" text NOT NULL,
	"research_version" text NOT NULL,
	"owner" text,
	"generation" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"lease_until" timestamp with time zone,
	"checkpoint" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "california_race_work" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "california_research_artifact" (
	"key" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"race_key" text NOT NULL,
	"candidate_id" text,
	"document" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "california_research_artifact" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "california_roster" (
	"id" text PRIMARY KEY NOT NULL,
	"election_date" text NOT NULL,
	"document" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "california_roster" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "candidate_brief_review_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "candidate_brief_revision" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "candidate_race_release" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "candidate_research_collection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "candidate_research_editor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "candidate_research_policy" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "candidate_brief_review_event" ADD COLUMN "attestation" jsonb;--> statement-breakpoint
ALTER TABLE "candidate_research_policy" ADD COLUMN "automation" jsonb;--> statement-breakpoint
ALTER TABLE "california_race_work" ADD CONSTRAINT "california_race_work_snapshot_id_california_roster_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."california_roster"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "california_work_snapshot_idx" ON "california_race_work" USING btree ("snapshot_id","status");--> statement-breakpoint
CREATE INDEX "california_roster_election_idx" ON "california_roster" USING btree ("election_date","created_at");