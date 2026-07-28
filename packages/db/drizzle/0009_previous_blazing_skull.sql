ALTER TABLE "video" ADD COLUMN "generated_image_path" text;--> statement-breakpoint
ALTER TABLE "video" ADD COLUMN "generated_image_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "video" ADD COLUMN "image_storage_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "video" ADD COLUMN "image_storage_error" text;--> statement-breakpoint
ALTER TABLE "video" ADD COLUMN "image_storage_attempts" integer DEFAULT 0;--> statement-breakpoint

-- Public editorial imagery is readable through the CDN. Uploads intentionally
-- have no anon/authenticated policy: only trusted scraper processes using a
-- Supabase secret/service-role key can write, update, or delete objects.
-- The repository also supports plain local Postgres, where Storage is absent.
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
