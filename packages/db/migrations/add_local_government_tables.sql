CREATE TABLE IF NOT EXISTS "local_government_meeting" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source" varchar(50) NOT NULL,
  "source_version" varchar(50) NOT NULL,
  "jurisdiction" varchar(100) NOT NULL,
  "governing_body" varchar(256) NOT NULL,
  "external_id" varchar(128) NOT NULL,
  "title" text NOT NULL,
  "meeting_type" varchar(50) NOT NULL,
  "status" varchar(50) NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "location" text,
  "canonical_url" text NOT NULL,
  "content_hash" varchar(64) NOT NULL,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone,
  CONSTRAINT "local_government_meeting_source_jurisdiction_external_id_unique"
    UNIQUE("source", "jurisdiction", "external_id")
);
CREATE INDEX IF NOT EXISTS "local_government_meeting_jurisdiction_date_idx"
  ON "local_government_meeting" ("jurisdiction", "starts_at");

CREATE TABLE IF NOT EXISTS "local_government_document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "meeting_id" uuid NOT NULL REFERENCES "local_government_meeting"("id") ON DELETE cascade,
  "type" varchar(30) NOT NULL,
  "title" text NOT NULL,
  "url" text NOT NULL,
  "media_type" varchar(100),
  "checksum" varchar(64),
  "extracted_text" text,
  "is_current" boolean DEFAULT true NOT NULL,
  "discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "fetched_at" timestamp with time zone,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone,
  CONSTRAINT "local_government_document_meeting_id_type_url_unique"
    UNIQUE("meeting_id", "type", "url")
);
CREATE INDEX IF NOT EXISTS "local_government_document_meeting_idx"
  ON "local_government_document" ("meeting_id");

CREATE TABLE IF NOT EXISTS "local_government_agenda_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "meeting_id" uuid NOT NULL REFERENCES "local_government_meeting"("id") ON DELETE cascade,
  "external_id" varchar(128) NOT NULL,
  "sequence" integer NOT NULL,
  "item_number" varchar(50),
  "section" varchar(100),
  "item_type" varchar(50) NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "consent" boolean DEFAULT false NOT NULL,
  "motion" text,
  "outcome" varchar(100),
  "vote_summary" text,
  "source_url" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone,
  CONSTRAINT "local_government_agenda_item_meeting_id_external_id_unique"
    UNIQUE("meeting_id", "external_id")
);
CREATE INDEX IF NOT EXISTS "local_government_agenda_item_meeting_sequence_idx"
  ON "local_government_agenda_item" ("meeting_id", "sequence");

CREATE TABLE IF NOT EXISTS "local_government_vote" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agenda_item_id" uuid NOT NULL REFERENCES "local_government_agenda_item"("id") ON DELETE cascade,
  "voter_name" varchar(256) NOT NULL,
  "value" varchar(50) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "local_government_vote_agenda_item_id_voter_name_unique"
    UNIQUE("agenda_item_id", "voter_name")
);
CREATE INDEX IF NOT EXISTS "local_government_vote_agenda_item_idx"
  ON "local_government_vote" ("agenda_item_id");
