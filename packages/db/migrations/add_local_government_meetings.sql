CREATE TABLE IF NOT EXISTS "local_government_meeting" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(50) NOT NULL,
  "jurisdiction" varchar(100) NOT NULL,
  "source_id" varchar(100) NOT NULL,
  "body_name" varchar(256) NOT NULL,
  "title" text NOT NULL,
  "meeting_type" varchar(100),
  "starts_at" timestamp with time zone NOT NULL,
  "timezone" varchar(64) NOT NULL,
  "location" text,
  "status" varchar(100) NOT NULL,
  "is_cancelled" boolean DEFAULT false NOT NULL,
  "is_amended" boolean DEFAULT false NOT NULL,
  "source_url" text NOT NULL,
  "video_url" text,
  "documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source_version" varchar(100) NOT NULL,
  "content_hash" varchar(64) NOT NULL,
  "source_updated_at" timestamp with time zone NOT NULL,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp,
  CONSTRAINT "local_government_meeting_provider_jurisdiction_source_id_unique" UNIQUE("provider", "jurisdiction", "source_id")
);
CREATE INDEX IF NOT EXISTS "local_government_meeting_starts_at_idx" ON "local_government_meeting" ("starts_at");

CREATE TABLE IF NOT EXISTS "local_government_meeting_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(50) NOT NULL,
  "jurisdiction" varchar(100) NOT NULL,
  "source_id" varchar(100) NOT NULL,
  "meeting_source_id" varchar(100) NOT NULL,
  "sequence" integer NOT NULL,
  "agenda_number" varchar(50),
  "title" text NOT NULL,
  "agenda_note" text,
  "minutes_note" text,
  "is_consent" boolean DEFAULT false NOT NULL,
  "action" text,
  "action_text" text,
  "outcome" varchar(100),
  "tally" varchar(100),
  "mover" varchar(256),
  "seconder" varchar(256),
  "documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source_version" varchar(100) NOT NULL,
  "content_hash" varchar(64) NOT NULL,
  "source_updated_at" timestamp with time zone NOT NULL,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp,
  CONSTRAINT "local_government_meeting_item_provider_jurisdiction_source_id_unique" UNIQUE("provider", "jurisdiction", "source_id")
);
CREATE INDEX IF NOT EXISTS "local_government_item_meeting_source_idx" ON "local_government_meeting_item" ("provider", "jurisdiction", "meeting_source_id");

CREATE TABLE IF NOT EXISTS "local_government_vote" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(50) NOT NULL,
  "jurisdiction" varchar(100) NOT NULL,
  "source_id" varchar(100) NOT NULL,
  "item_source_id" varchar(100) NOT NULL,
  "person_source_id" varchar(100),
  "person_name" varchar(256) NOT NULL,
  "value" varchar(100) NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "source_updated_at" timestamp with time zone NOT NULL,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp,
  CONSTRAINT "local_government_vote_provider_jurisdiction_source_id_unique" UNIQUE("provider", "jurisdiction", "source_id")
);
CREATE INDEX IF NOT EXISTS "local_government_vote_item_source_idx" ON "local_government_vote" ("provider", "jurisdiction", "item_source_id");
