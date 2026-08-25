CREATE TABLE "content_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" varchar(20) NOT NULL,
	"content_id" uuid NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"storage_path" text NOT NULL,
	"image_hash" varchar(64) NOT NULL,
	"prompt" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "content_image_content_type_content_id_unique" UNIQUE("content_type","content_id")
);
--> statement-breakpoint
CREATE INDEX "content_image_content_id_idx" ON "content_image" USING btree ("content_id");--> statement-breakpoint
ALTER TABLE "content_image" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
		REVOKE ALL ON TABLE "content_image" FROM anon;
	END IF;
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		REVOKE ALL ON TABLE "content_image" FROM authenticated;
	END IF;
END
$$;--> statement-breakpoint

-- Public editorial images are readable from the CDN. Uploads have no public
-- policy; only the trusted scraper's server-side Supabase secret can write.
-- Plain local Postgres does not have the Storage schema, so keep that setup
-- usable for tests and local development.
DO $$
BEGIN
	IF to_regclass('storage.buckets') IS NOT NULL THEN
		INSERT INTO storage.buckets (
			"id",
			"name",
			"public",
			"file_size_limit",
			"allowed_mime_types"
		) VALUES (
			'content-images',
			'content-images',
			true,
			5242880,
			ARRAY['image/jpeg']::text[]
		)
		ON CONFLICT ("id") DO UPDATE SET
			"public" = EXCLUDED."public",
			"file_size_limit" = EXCLUDED."file_size_limit",
			"allowed_mime_types" = EXCLUDED."allowed_mime_types";
	ELSE
		RAISE NOTICE 'Supabase Storage schema not present; skipping content-images bucket';
	END IF;
END
$$;
