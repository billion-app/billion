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
	CONSTRAINT "election_source_provider_source_kind_election_date_source_url_unique" UNIQUE("provider","source_kind","election_date","source_url")
);
--> statement-breakpoint
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
	CONSTRAINT "election_candidate_source_id_county_contest_name_party_unique" UNIQUE("source_id","county","contest","name","party")
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
	CONSTRAINT "election_referendum_source_id_county_contest_choice_unique" UNIQUE("source_id","county","contest","choice")
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
	CONSTRAINT "election_result_source_id_county_precinct_contest_choice_unique" UNIQUE("source_id","county","precinct","contest","choice")
);
--> statement-breakpoint
ALTER TABLE "election_candidate" ADD CONSTRAINT "election_candidate_source_id_election_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."election_source"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "election_referendum" ADD CONSTRAINT "election_referendum_source_id_election_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."election_source"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "election_result" ADD CONSTRAINT "election_result_source_id_election_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."election_source"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "election_source_date_idx" ON "election_source" USING btree ("election_date");
--> statement-breakpoint
CREATE INDEX "election_candidate_lookup_idx" ON "election_candidate" USING btree ("election_date","county");
--> statement-breakpoint
CREATE INDEX "election_referendum_lookup_idx" ON "election_referendum" USING btree ("election_date","county");
--> statement-breakpoint
CREATE INDEX "election_result_lookup_idx" ON "election_result" USING btree ("election_date","county");
