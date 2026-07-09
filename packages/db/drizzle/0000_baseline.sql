CREATE TABLE "bill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_number" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sponsor" varchar(256),
	"status" varchar(100),
	"introduced_date" timestamp,
	"congress" integer,
	"chamber" varchar(50),
	"summary" text,
	"full_text" text,
	"ai_generated_article" text,
	"thumbnail_url" text,
	"images" jsonb DEFAULT '[]'::jsonb,
	"actions" jsonb DEFAULT '[]'::jsonb,
	"url" text NOT NULL,
	"source_website" varchar(50) NOT NULL,
	"content_hash" varchar(64) DEFAULT '' NOT NULL,
	"versions" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "bill_billNumber_sourceWebsite_unique" UNIQUE("bill_number","source_website")
);
--> statement-breakpoint
CREATE TABLE "blocked_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_content_userId_name_type_unique" UNIQUE("user_id","name","type")
);
--> statement-breakpoint
CREATE TABLE "candidate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"name" text NOT NULL,
	"party" varchar(100),
	"candidate_url" text,
	"photo_url" text,
	"email" text,
	"phone" varchar(50),
	"incumbent" boolean DEFAULT false,
	"biography" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "civic_api_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address_hash" varchar(64) NOT NULL,
	"endpoint" varchar(50) NOT NULL,
	"params" text DEFAULT '{}' NOT NULL,
	"response_data" jsonb NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "civic_api_cache_addressHash_endpoint_params_unique" UNIQUE("address_hash","endpoint","params")
);
--> statement-breakpoint
CREATE TABLE "contest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" uuid NOT NULL,
	"office" text,
	"district_name" text,
	"district_scope" varchar(50),
	"number_elected" integer DEFAULT 1,
	"referendum_title" text,
	"referendum_subtitle" text,
	"referendum_text" text,
	"referendum_pro_statement" text,
	"referendum_con_statement" text,
	"referendum_url" text,
	"type" varchar(20) NOT NULL,
	"role_description" text,
	"summary" text,
	"summary_is_ai_generated" boolean DEFAULT false,
	"fiscal_impact" text,
	"citations" jsonb DEFAULT '[]'::jsonb,
	"source" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "court_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_number" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"court" varchar(256) NOT NULL,
	"filed_date" timestamp,
	"description" text,
	"status" varchar(100),
	"full_text" text,
	"ai_generated_article" text,
	"thumbnail_url" text,
	"images" jsonb DEFAULT '[]'::jsonb,
	"url" text NOT NULL,
	"content_hash" varchar(64) DEFAULT '' NOT NULL,
	"versions" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "court_case_caseNumber_unique" UNIQUE("case_number")
);
--> statement-breakpoint
CREATE TABLE "election" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(100),
	"name" text NOT NULL,
	"date" varchar(20) NOT NULL,
	"election_type" varchar(20) NOT NULL,
	"ocd_division_id" text,
	"source" varchar(50) NOT NULL,
	"deadlines" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "election_externalId_source_unique" UNIQUE("external_id","source")
);
--> statement-breakpoint
CREATE TABLE "government_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"published_date" timestamp NOT NULL,
	"description" text,
	"full_text" text,
	"ai_generated_article" text,
	"thumbnail_url" text,
	"images" jsonb DEFAULT '[]'::jsonb,
	"url" text NOT NULL,
	"source" varchar(100) DEFAULT 'whitehouse.gov' NOT NULL,
	"content_hash" varchar(64) DEFAULT '' NOT NULL,
	"versions" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "government_content_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "legistar_agenda_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction" varchar(50) NOT NULL,
	"event_item_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"agenda_sequence" integer,
	"agenda_number" varchar(50),
	"title" text,
	"action_name" varchar(256),
	"passed_flag_name" varchar(50),
	"tally" varchar(50),
	"mover_name" varchar(256),
	"seconder_name" varchar(256),
	"matter_id" integer,
	"matter_file" varchar(100),
	"matter_name" text,
	"matter_type" varchar(100),
	"matter_status" varchar(100),
	"consent" boolean DEFAULT false,
	"agenda_note" text,
	"minutes_note" text,
	"last_modified_utc" timestamp NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "legistar_agenda_item_jurisdiction_eventItemId_unique" UNIQUE("jurisdiction","event_item_id")
);
--> statement-breakpoint
CREATE TABLE "legistar_body" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction" varchar(50) NOT NULL,
	"body_id" integer NOT NULL,
	"body_guid" varchar(100),
	"name" text NOT NULL,
	"type_name" varchar(100),
	"active_flag" boolean DEFAULT true,
	"number_of_members" integer,
	"description" text,
	"contact_name" varchar(256),
	"contact_email" varchar(256),
	"contact_phone" varchar(50),
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "legistar_body_jurisdiction_bodyId_unique" UNIQUE("jurisdiction","body_id")
);
--> statement-breakpoint
CREATE TABLE "legistar_matter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction" varchar(50) NOT NULL,
	"matter_id" integer NOT NULL,
	"matter_guid" varchar(100),
	"matter_file" varchar(100),
	"title" text NOT NULL,
	"name" text,
	"type_name" varchar(100),
	"status_name" varchar(100),
	"body_name" varchar(256),
	"body_id" integer,
	"intro_date" timestamp,
	"agenda_date" timestamp,
	"passed_date" timestamp,
	"enactment_date" timestamp,
	"enactment_number" varchar(100),
	"requester" text,
	"notes" text,
	"last_modified_utc" timestamp NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "legistar_matter_jurisdiction_matterId_unique" UNIQUE("jurisdiction","matter_id")
);
--> statement-breakpoint
CREATE TABLE "legistar_meeting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction" varchar(50) NOT NULL,
	"event_id" integer NOT NULL,
	"event_guid" varchar(100),
	"body_id" integer,
	"body_name" varchar(256),
	"date" timestamp NOT NULL,
	"time" text,
	"location" text,
	"agenda_file" text,
	"minutes_file" text,
	"video_path" text,
	"agenda_status_name" varchar(100),
	"minutes_status_name" varchar(100),
	"comment" text,
	"in_site_url" text,
	"last_modified_utc" timestamp NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "legistar_meeting_jurisdiction_eventId_unique" UNIQUE("jurisdiction","event_id")
);
--> statement-breakpoint
CREATE TABLE "legistar_vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction" varchar(50) NOT NULL,
	"vote_id" integer NOT NULL,
	"event_item_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"person_name" varchar(256) NOT NULL,
	"value_name" varchar(50) NOT NULL,
	"sort" integer,
	"last_modified_utc" timestamp NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "legistar_vote_jurisdiction_voteId_unique" UNIQUE("jurisdiction","vote_id")
);
--> statement-breakpoint
CREATE TABLE "polling_location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" uuid,
	"name" text,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"state" varchar(2) NOT NULL,
	"zip" varchar(10) NOT NULL,
	"hours" text,
	"latitude" double precision,
	"longitude" double precision,
	"location_type" varchar(20) NOT NULL,
	"voter_services" jsonb DEFAULT '[]'::jsonb,
	"start_date" varchar(20),
	"end_date" varchar(20),
	"source" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(256) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "role_description" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" varchar(50) NOT NULL,
	"level" varchar(50),
	"description" text NOT NULL,
	"source" varchar(20) DEFAULT 'seed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "role_description_role_level_unique" UNIQUE("role","level")
);
--> statement-breakpoint
CREATE TABLE "saved_article" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"content_id" uuid NOT NULL,
	"content_type" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_article_userId_contentId_unique" UNIQUE("user_id","content_id")
);
--> statement-breakpoint
CREATE TABLE "user_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "user_preference_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"location" boolean DEFAULT true NOT NULL,
	"personalize" boolean DEFAULT true NOT NULL,
	"analytics" boolean DEFAULT false NOT NULL,
	"crash" boolean DEFAULT true NOT NULL,
	"offline" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "user_settings_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "video" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" varchar(20) NOT NULL,
	"content_id" uuid NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"image_data" "bytea",
	"image_mime_type" varchar(50),
	"image_width" integer,
	"image_height" integer,
	"thumbnail_url" text,
	"author" varchar(100),
	"engagement_metrics" jsonb DEFAULT '{"likes":0,"comments":0,"shares":0}'::jsonb,
	"source_content_hash" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "video_contentType_contentId_unique" UNIQUE("content_type","content_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocked_content_user_id_idx" ON "blocked_content" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "candidate_contest_id_idx" ON "candidate" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "civic_cache_expires_idx" ON "civic_api_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "contest_election_id_idx" ON "contest" USING btree ("election_id");--> statement-breakpoint
CREATE INDEX "legistar_agenda_item_event_idx" ON "legistar_agenda_item" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "legistar_matter_file_idx" ON "legistar_matter" USING btree ("matter_file");--> statement-breakpoint
CREATE INDEX "legistar_meeting_date_idx" ON "legistar_meeting" USING btree ("date");--> statement-breakpoint
CREATE INDEX "legistar_vote_event_item_idx" ON "legistar_vote" USING btree ("event_item_id");--> statement-breakpoint
CREATE INDEX "legistar_vote_person_idx" ON "legistar_vote" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "polling_location_election_id_idx" ON "polling_location" USING btree ("election_id");--> statement-breakpoint
CREATE INDEX "saved_article_user_id_idx" ON "saved_article" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "video_content_id_idx" ON "video" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "video_created_at_idx" ON "video" USING btree ("created_at");