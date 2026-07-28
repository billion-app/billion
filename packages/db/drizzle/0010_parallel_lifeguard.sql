CREATE TABLE "bill_section_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"section_hash" varchar(64) NOT NULL,
	"prompt_version" varchar(100) NOT NULL,
	"model_version" varchar(100) NOT NULL,
	"status" varchar(20) NOT NULL,
	"notes" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "bill_section_analysis_sectionId_promptVersion_modelVersion_unique" UNIQUE("section_id","prompt_version","model_version")
);
--> statement-breakpoint
ALTER TABLE "bill_section_analysis" ADD CONSTRAINT "bill_section_analysis_section_id_bill_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."bill_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_section_analysis_cache_key_idx" ON "bill_section_analysis" USING btree ("section_hash","prompt_version","model_version","status");--> statement-breakpoint
CREATE INDEX "bill_section_analysis_section_idx" ON "bill_section_analysis" USING btree ("section_id");