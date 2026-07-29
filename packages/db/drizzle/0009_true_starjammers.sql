CREATE TABLE "brief_change_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_brief_id" uuid NOT NULL,
	"change_index" integer NOT NULL,
	"change_hash" varchar(64) NOT NULL,
	"image_data" "bytea",
	"image_mime_type" varchar(50),
	"image_width" integer,
	"image_height" integer,
	"prompt" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "brief_change_image_contentBriefId_changeIndex_unique" UNIQUE("content_brief_id","change_index")
);
--> statement-breakpoint
ALTER TABLE "brief_change_image" ADD CONSTRAINT "brief_change_image_content_brief_id_content_brief_id_fk" FOREIGN KEY ("content_brief_id") REFERENCES "public"."content_brief"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brief_change_image_brief_id_idx" ON "brief_change_image" USING btree ("content_brief_id");