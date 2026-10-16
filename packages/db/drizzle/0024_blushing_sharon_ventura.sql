CREATE TABLE "candidate_race_release" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document" jsonb NOT NULL,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
