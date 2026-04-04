/**
 * Migration: move Video.imageData (bytea) blobs to Supabase Storage.
 *
 * For each Video row that has imageData but no imageUrl:
 *   1. Upload the buffer to Supabase Storage
 *   2. Write the public URL back to imageUrl
 *   3. Null out imageData to free space
 *
 * After running this and verifying, drop the imageData column:
 *   ALTER TABLE video DROP COLUMN image_data;
 *   ALTER TABLE video DROP COLUMN image_mime_type;
 *   ALTER TABLE video DROP COLUMN image_width;
 *   ALTER TABLE video DROP COLUMN image_height;
 *
 * Usage: pnpm with-env tsx migrate-images-to-storage.ts [--dry-run]
 */

import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, "../../.env") });

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "images";
const dryRun = process.argv.includes("--dry-run");

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

async function migrate() {
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
  const supabase = getSupabase();

  console.log(dryRun ? "[DRY RUN] " : "", "Starting image migration...\n");

  const client = await pool.connect();

  try {
    // Find all videos with binary data but no storage URL
    const { rows } = await client.query<{
      id: string;
      content_type: string;
      content_id: string;
      image_data: Buffer;
      image_mime_type: string | null;
    }>(
      `SELECT id, content_type, content_id, image_data, image_mime_type
       FROM video
       WHERE image_data IS NOT NULL AND image_url IS NULL`,
    );

    console.log(`Found ${rows.length} videos to migrate\n`);

    let migrated = 0;
    let errors = 0;

    for (const row of rows) {
      const storagePath = `videos/${row.content_type}/${row.content_id}.jpg`;
      const mimeType = row.image_mime_type ?? "image/jpeg";

      try {
        if (dryRun) {
          console.log(`  [DRY RUN] Would upload ${storagePath} (${row.image_data.length} bytes)`);
          migrated++;
          continue;
        }

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, row.image_data, {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

        // Write URL back and clear blob
        await client.query(
          `UPDATE video
           SET image_url = $1, image_data = NULL, image_mime_type = NULL,
               image_width = NULL, image_height = NULL
           WHERE id = $2`,
          [publicUrl, row.id],
        );

        migrated++;
        console.log(`  Migrated: ${storagePath}`);
      } catch (err) {
        errors++;
        console.error(`  Failed: ${storagePath} — ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log(`\nDone: ${migrated} migrated, ${errors} errors`);

    if (!dryRun && migrated > 0 && errors === 0) {
      console.log(
        "\nAll blobs migrated. You can now drop the old columns:\n" +
          "  ALTER TABLE video DROP COLUMN image_data;\n" +
          "  ALTER TABLE video DROP COLUMN image_mime_type;\n" +
          "  ALTER TABLE video DROP COLUMN image_width;\n" +
          "  ALTER TABLE video DROP COLUMN image_height;",
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
