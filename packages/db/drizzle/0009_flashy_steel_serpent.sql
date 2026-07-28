CREATE TABLE "bill_section" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_version_id" uuid NOT NULL,
	"parent_section_id" uuid,
	"structural_path" text NOT NULL,
	"displayed_number" text,
	"heading" text,
	"order" integer NOT NULL,
	"text" text NOT NULL,
	"section_hash" varchar(64) NOT NULL,
	"token_count" integer NOT NULL,
	"source_start_offset" integer,
	"source_end_offset" integer,
	"xml_id" text,
	"cross_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(heading, '') || ' ' || coalesce(text, ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_section_sourceVersionId_structuralPath_unique" UNIQUE("source_version_id","structural_path")
);
--> statement-breakpoint
CREATE TABLE "bill_source_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"version_code" varchar(50) NOT NULL,
	"version_type" text NOT NULL,
	"official_date" timestamp with time zone,
	"source_url" text NOT NULL,
	"raw_xml" text NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"parse_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"parse_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "bill_source_version_billId_versionCode_sourceHash_unique" UNIQUE("bill_id","version_code","source_hash")
);
--> statement-breakpoint
ALTER TABLE "bill" drop column "search_vector";--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS ((
        setweight(to_tsvector('english', coalesce(bill_number, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(sponsor, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(description, '')), 'B')
      )) STORED;--> statement-breakpoint
ALTER TABLE "bill_section" ADD CONSTRAINT "bill_section_source_version_id_bill_source_version_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."bill_source_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_section" ADD CONSTRAINT "bill_section_parent_section_id_bill_section_id_fk" FOREIGN KEY ("parent_section_id") REFERENCES "public"."bill_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_source_version" ADD CONSTRAINT "bill_source_version_bill_id_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_section_source_version_idx" ON "bill_section" USING btree ("source_version_id");--> statement-breakpoint
CREATE INDEX "bill_section_parent_idx" ON "bill_section" USING btree ("parent_section_id");--> statement-breakpoint
CREATE INDEX "bill_section_search_vector_idx" ON "bill_section" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "bill_source_version_bill_idx" ON "bill_source_version" USING btree ("bill_id");