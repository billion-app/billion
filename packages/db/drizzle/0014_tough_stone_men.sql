CREATE TABLE "local_body" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_key" varchar(50) NOT NULL,
	"source_body_id" integer NOT NULL,
	"source_guid" varchar(100),
	"name" text NOT NULL,
	"type_name" varchar(100),
	"active" boolean DEFAULT true NOT NULL,
	"included" boolean DEFAULT false NOT NULL,
	"relevance_tier" integer DEFAULT 3 NOT NULL,
	"number_of_members" integer,
	"description" text,
	"contact_name" varchar(256),
	"contact_email" varchar(256),
	"contact_phone" varchar(50),
	"source_updated_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_body_jurisdictionKey_sourceBodyId_unique" UNIQUE("jurisdiction_key","source_body_id")
);
--> statement-breakpoint
CREATE TABLE "local_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_key" varchar(50) NOT NULL,
	"primary_body_id" uuid,
	"source_matter_id" integer NOT NULL,
	"source_guid" varchar(100),
	"file_number" varchar(100),
	"title" text NOT NULL,
	"name" text,
	"type_name" varchar(100),
	"status_name" varchar(100),
	"topic" varchar(80),
	"scope_kind" varchar(30) DEFAULT 'unknown' NOT NULL,
	"district_numbers" integer[],
	"geographic_text" text,
	"intro_date" timestamp with time zone,
	"agenda_date" timestamp with time zone,
	"passed_date" timestamp with time zone,
	"enactment_date" timestamp with time zone,
	"enactment_number" varchar(100),
	"requester" text,
	"notes" text,
	"source_url" text,
	"source_updated_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_deleted_at" timestamp with time zone,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS ((
        setweight(to_tsvector('english', coalesce(file_number, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(type_name, '') || ' ' || coalesce(topic, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(requester, '') || ' ' || coalesce(notes, '') || ' ' || coalesce(geographic_text, '')), 'C')
      )) STORED,
	CONSTRAINT "local_decision_jurisdictionKey_sourceMatterId_unique" UNIQUE("jurisdiction_key","source_matter_id")
);
--> statement-breakpoint
CREATE TABLE "local_decision_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_key" varchar(50) NOT NULL,
	"decision_id" uuid NOT NULL,
	"source_attachment_id" integer NOT NULL,
	"source_guid" varchar(100),
	"name" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"file_name" text,
	"category" varchar(50) NOT NULL,
	"sort_order" integer,
	"is_supporting_document" boolean DEFAULT false NOT NULL,
	"is_public_comment" boolean DEFAULT false NOT NULL,
	"processing_policy" varchar(30) NOT NULL,
	"extraction_status" varchar(30) DEFAULT 'pending' NOT NULL,
	"extracted_text" text,
	"extraction_method" varchar(30),
	"extraction_quality" real,
	"page_count" integer,
	"byte_size" integer,
	"mime_type" varchar(100),
	"content_hash" varchar(64),
	"source_updated_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_deleted_at" timestamp with time zone,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_decision_document_jurisdictionKey_sourceAttachmentId_unique" UNIQUE("jurisdiction_key","source_attachment_id")
);
--> statement-breakpoint
CREATE TABLE "local_decision_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"source_history_id" integer NOT NULL,
	"source_event_id" integer,
	"source_event_item_id" integer,
	"body_name" varchar(256),
	"action_name" varchar(256),
	"action_text" text,
	"action_date" timestamp with time zone,
	"agenda_number" varchar(50),
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_decision_history_decisionId_sourceHistoryId_unique" UNIQUE("decision_id","source_history_id")
);
--> statement-breakpoint
CREATE TABLE "local_decision_vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_item_id" uuid NOT NULL,
	"source_vote_id" integer NOT NULL,
	"source_person_id" integer NOT NULL,
	"person_name" varchar(256) NOT NULL,
	"value_name" varchar(50) NOT NULL,
	"sort_order" integer,
	"source_updated_at" timestamp with time zone NOT NULL,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_decision_vote_meetingItemId_sourceVoteId_unique" UNIQUE("meeting_item_id","source_vote_id")
);
--> statement-breakpoint
CREATE TABLE "local_ingestion_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_key" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "local_jurisdiction" (
	"key" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"state" varchar(2) NOT NULL,
	"government_level" varchar(30) NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"source_type" varchar(30) NOT NULL,
	"source_client" varchar(100) NOT NULL,
	"source_base_url" text NOT NULL,
	"public_portal_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_meeting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_key" varchar(50) NOT NULL,
	"body_id" uuid NOT NULL,
	"source_event_id" integer NOT NULL,
	"source_guid" varchar(100),
	"starts_at" timestamp with time zone NOT NULL,
	"local_date" varchar(10) NOT NULL,
	"time_label" text,
	"location" text,
	"agenda_url" text,
	"minutes_url" text,
	"video_url" text,
	"source_url" text,
	"agenda_status_name" varchar(100),
	"minutes_status_name" varchar(100),
	"comment" text,
	"cancelled" boolean DEFAULT false NOT NULL,
	"source_updated_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_deleted_at" timestamp with time zone,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_meeting_jurisdictionKey_sourceEventId_unique" UNIQUE("jurisdiction_key","source_event_id")
);
--> statement-breakpoint
CREATE TABLE "local_meeting_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"decision_id" uuid,
	"source_event_item_id" integer NOT NULL,
	"source_guid" varchar(100),
	"agenda_sequence" integer,
	"minutes_sequence" integer,
	"agenda_number" varchar(50),
	"title" text,
	"action_name" varchar(256),
	"action_text" text,
	"passed_flag_name" varchar(50),
	"tally" varchar(50),
	"mover_name" varchar(256),
	"seconder_name" varchar(256),
	"consent" boolean DEFAULT false NOT NULL,
	"roll_call" boolean DEFAULT false NOT NULL,
	"agenda_note" text,
	"minutes_note" text,
	"video_index" integer,
	"source_updated_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_deleted_at" timestamp with time zone,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_meeting_item_meetingId_sourceEventItemId_unique" UNIQUE("meeting_id","source_event_item_id")
);
--> statement-breakpoint
DROP TABLE "legistar_agenda_item" CASCADE;--> statement-breakpoint
DROP TABLE "legistar_body" CASCADE;--> statement-breakpoint
DROP TABLE "legistar_matter" CASCADE;--> statement-breakpoint
DROP TABLE "legistar_meeting" CASCADE;--> statement-breakpoint
DROP TABLE "legistar_vote" CASCADE;--> statement-breakpoint
ALTER TABLE "local_body" ADD CONSTRAINT "local_body_jurisdiction_key_local_jurisdiction_key_fk" FOREIGN KEY ("jurisdiction_key") REFERENCES "public"."local_jurisdiction"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_decision" ADD CONSTRAINT "local_decision_jurisdiction_key_local_jurisdiction_key_fk" FOREIGN KEY ("jurisdiction_key") REFERENCES "public"."local_jurisdiction"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_decision" ADD CONSTRAINT "local_decision_primary_body_id_local_body_id_fk" FOREIGN KEY ("primary_body_id") REFERENCES "public"."local_body"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_decision_document" ADD CONSTRAINT "local_decision_document_jurisdiction_key_local_jurisdiction_key_fk" FOREIGN KEY ("jurisdiction_key") REFERENCES "public"."local_jurisdiction"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_decision_document" ADD CONSTRAINT "local_decision_document_decision_id_local_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."local_decision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_decision_history" ADD CONSTRAINT "local_decision_history_decision_id_local_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."local_decision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_decision_vote" ADD CONSTRAINT "local_decision_vote_meeting_item_id_local_meeting_item_id_fk" FOREIGN KEY ("meeting_item_id") REFERENCES "public"."local_meeting_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_ingestion_run" ADD CONSTRAINT "local_ingestion_run_jurisdiction_key_local_jurisdiction_key_fk" FOREIGN KEY ("jurisdiction_key") REFERENCES "public"."local_jurisdiction"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_meeting" ADD CONSTRAINT "local_meeting_jurisdiction_key_local_jurisdiction_key_fk" FOREIGN KEY ("jurisdiction_key") REFERENCES "public"."local_jurisdiction"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_meeting" ADD CONSTRAINT "local_meeting_body_id_local_body_id_fk" FOREIGN KEY ("body_id") REFERENCES "public"."local_body"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_meeting_item" ADD CONSTRAINT "local_meeting_item_meeting_id_local_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."local_meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_meeting_item" ADD CONSTRAINT "local_meeting_item_decision_id_local_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."local_decision"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "local_body_jurisdiction_included_idx" ON "local_body" USING btree ("jurisdiction_key","included","relevance_tier");--> statement-breakpoint
CREATE INDEX "local_decision_primary_body_idx" ON "local_decision" USING btree ("primary_body_id");--> statement-breakpoint
CREATE INDEX "local_decision_active_updated_idx" ON "local_decision" USING btree ("jurisdiction_key","source_updated_at") WHERE "local_decision"."source_deleted_at" is null;--> statement-breakpoint
CREATE INDEX "local_decision_search_vector_idx" ON "local_decision" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "local_document_decision_category_idx" ON "local_decision_document" USING btree ("decision_id","category");--> statement-breakpoint
CREATE INDEX "local_document_extraction_queue_idx" ON "local_decision_document" USING btree ("extraction_status") WHERE "local_decision_document"."source_deleted_at" is null;--> statement-breakpoint
CREATE INDEX "local_history_decision_action_date_idx" ON "local_decision_history" USING btree ("decision_id","action_date");--> statement-breakpoint
CREATE INDEX "local_vote_meeting_item_idx" ON "local_decision_vote" USING btree ("meeting_item_id");--> statement-breakpoint
CREATE INDEX "local_vote_source_person_idx" ON "local_decision_vote" USING btree ("source_person_id");--> statement-breakpoint
CREATE INDEX "local_ingestion_jurisdiction_started_idx" ON "local_ingestion_run" USING btree ("jurisdiction_key","started_at");--> statement-breakpoint
CREATE INDEX "local_meeting_body_starts_at_idx" ON "local_meeting" USING btree ("body_id","starts_at");--> statement-breakpoint
CREATE INDEX "local_meeting_active_starts_at_idx" ON "local_meeting" USING btree ("jurisdiction_key","starts_at") WHERE "local_meeting"."source_deleted_at" is null;--> statement-breakpoint
CREATE INDEX "local_meeting_item_sequence_idx" ON "local_meeting_item" USING btree ("meeting_id","agenda_sequence");--> statement-breakpoint
CREATE INDEX "local_meeting_item_decision_idx" ON "local_meeting_item" USING btree ("decision_id");--> statement-breakpoint
-- These tables live in Supabase's exposed public schema, but Billion serves
-- them through the server-side tRPC API. Enabling RLS with no anon/authenticated
-- policies keeps the Data API closed while database owners/service roles can
-- still run ingestion and server reads.
ALTER TABLE "local_jurisdiction" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "local_body" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "local_decision" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "local_meeting" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "local_meeting_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "local_decision_document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "local_decision_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "local_decision_vote" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "local_ingestion_run" ENABLE ROW LEVEL SECURITY;
