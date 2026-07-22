CREATE TABLE "election_candidate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"election_date" date NOT NULL,
	"county" varchar(100) NOT NULL,
	"contest" text NOT NULL,
	"name" text NOT NULL,
	"party" varchar(30),
	"vote_for" integer,
	"term_years" integer,
	"has_primary" boolean,
	"is_partisan" boolean,
	CONSTRAINT "election_candidate_sourceId_county_contest_name_party_unique" UNIQUE("source_id","county","contest","name","party")
);
--> statement-breakpoint
CREATE TABLE "election_referendum" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"election_date" date NOT NULL,
	"county" varchar(100) NOT NULL,
	"contest" text NOT NULL,
	"choice" text NOT NULL,
	"description" text,
	CONSTRAINT "election_referendum_sourceId_county_contest_choice_unique" UNIQUE("source_id","county","contest","choice")
);
--> statement-breakpoint
CREATE TABLE "election_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"election_date" date NOT NULL,
	"county" varchar(100) NOT NULL,
	"precinct" varchar(100) NOT NULL,
	"contest_id" varchar(100),
	"contest_type" varchar(30),
	"contest" text NOT NULL,
	"choice" text NOT NULL,
	"party" varchar(30),
	"vote_for" integer,
	"election_day_votes" integer NOT NULL,
	"early_voting_votes" integer NOT NULL,
	"absentee_mail_votes" integer NOT NULL,
	"provisional_votes" integer NOT NULL,
	"total_votes" integer NOT NULL,
	"real_precinct" boolean,
	CONSTRAINT "election_result_sourceId_county_precinct_contest_choice_unique" UNIQUE("source_id","county","precinct","contest","choice")
);
--> statement-breakpoint
CREATE TABLE "election_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(50) NOT NULL,
	"source_kind" varchar(30) NOT NULL,
	"election_date" date NOT NULL,
	"source_url" text NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"structure_version" varchar(50) NOT NULL,
	"certification_status" varchar(30) DEFAULT 'unknown' NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "election_source_provider_sourceKind_electionDate_sourceUrl_unique" UNIQUE("provider","source_kind","election_date","source_url")
);
--> statement-breakpoint
CREATE TABLE "election_source_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction" varchar(20) NOT NULL,
	"cycle_year" integer NOT NULL,
	"provider" varchar(50) NOT NULL,
	"scope" varchar(50) DEFAULT 'current' NOT NULL,
	"source_version" varchar(150) NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"data" jsonb NOT NULL,
	"diagnostics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "election_source_snapshot_jurisdiction_cycleYear_provider_scope_unique" UNIQUE("jurisdiction","cycle_year","provider","scope")
);
--> statement-breakpoint
CREATE TABLE "local_government_agenda_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"external_id" varchar(128) NOT NULL,
	"sequence" integer NOT NULL,
	"item_number" varchar(50),
	"section" varchar(100),
	"item_type" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"minutes_note" text,
	"consent" boolean DEFAULT false NOT NULL,
	"action" text,
	"motion" text,
	"outcome" varchar(100),
	"vote_summary" text,
	"mover" varchar(256),
	"seconder" varchar(256),
	"source_version" varchar(100),
	"content_hash" varchar(64),
	"source_updated_at" timestamp with time zone,
	"source_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "local_government_agenda_item_meetingId_externalId_unique" UNIQUE("meeting_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "local_government_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
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
	CONSTRAINT "local_government_document_meetingId_type_url_unique" UNIQUE("meeting_id","type","url")
);
--> statement-breakpoint
CREATE TABLE "local_government_meeting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_version" varchar(100) NOT NULL,
	"jurisdiction" varchar(100) NOT NULL,
	"governing_body" varchar(256) NOT NULL,
	"external_id" varchar(128) NOT NULL,
	"title" text NOT NULL,
	"meeting_type" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"timezone" varchar(64),
	"location" text,
	"is_cancelled" boolean DEFAULT false NOT NULL,
	"is_amended" boolean DEFAULT false NOT NULL,
	"canonical_url" text NOT NULL,
	"video_url" text,
	"content_hash" varchar(64) NOT NULL,
	"source_updated_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "local_government_meeting_source_jurisdiction_externalId_unique" UNIQUE("source","jurisdiction","external_id")
);
--> statement-breakpoint
CREATE TABLE "local_government_vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agenda_item_id" uuid NOT NULL,
	"external_id" varchar(128),
	"voter_external_id" varchar(128),
	"voter_name" varchar(256) NOT NULL,
	"value" varchar(50) NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"source_updated_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "local_government_vote_agendaItemId_voterName_unique" UNIQUE("agenda_item_id","voter_name")
);
--> statement-breakpoint
ALTER TABLE "bill" DROP CONSTRAINT "bill_billNumber_sourceWebsite_unique";--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "jurisdiction" varchar(100) DEFAULT 'ocd-jurisdiction/country:us/government' NOT NULL;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "legislative_session" varchar(20) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "open_states_id" text;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "subjects" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "sponsorships" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "documents" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "votes" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "election_candidate" ADD CONSTRAINT "election_candidate_source_id_election_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."election_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_referendum" ADD CONSTRAINT "election_referendum_source_id_election_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."election_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_result" ADD CONSTRAINT "election_result_source_id_election_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."election_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_government_agenda_item" ADD CONSTRAINT "local_government_agenda_item_meeting_id_local_government_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."local_government_meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_government_document" ADD CONSTRAINT "local_government_document_meeting_id_local_government_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."local_government_meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_government_vote" ADD CONSTRAINT "local_government_vote_agenda_item_id_local_government_agenda_item_id_fk" FOREIGN KEY ("agenda_item_id") REFERENCES "public"."local_government_agenda_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "election_candidate_lookup_idx" ON "election_candidate" USING btree ("election_date","county");--> statement-breakpoint
CREATE INDEX "election_referendum_lookup_idx" ON "election_referendum" USING btree ("election_date","county");--> statement-breakpoint
CREATE INDEX "election_result_lookup_idx" ON "election_result" USING btree ("election_date","county");--> statement-breakpoint
CREATE INDEX "election_source_date_idx" ON "election_source" USING btree ("election_date");--> statement-breakpoint
CREATE INDEX "election_snapshot_current_cycle_idx" ON "election_source_snapshot" USING btree ("jurisdiction","scope","cycle_year");--> statement-breakpoint
CREATE INDEX "local_government_agenda_item_meeting_sequence_idx" ON "local_government_agenda_item" USING btree ("meeting_id","sequence");--> statement-breakpoint
CREATE INDEX "local_government_document_meeting_idx" ON "local_government_document" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "local_government_meeting_jurisdiction_date_idx" ON "local_government_meeting" USING btree ("jurisdiction","starts_at");--> statement-breakpoint
CREATE INDEX "local_government_vote_agenda_item_idx" ON "local_government_vote" USING btree ("agenda_item_id");--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_billNumber_sourceWebsite_legislativeSession_unique" UNIQUE("bill_number","source_website","legislative_session");