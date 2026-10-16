CREATE TABLE "candidate_brief_review_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"policy_version" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_brief_revision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identity_key" text NOT NULL,
	"revision_digest" text NOT NULL,
	"document" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_brief_revision_revisionDigest_unique" UNIQUE("revision_digest")
);
--> statement-breakpoint
ALTER TABLE "candidate_brief_review_event" ADD CONSTRAINT "candidate_brief_review_event_revision_id_candidate_brief_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."candidate_brief_revision"("id") ON DELETE no action ON UPDATE no action;