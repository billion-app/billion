import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root
config({ path: join(__dirname, "../../.env") });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function migrate() {
  console.log("🚀 Running image field migrations...\n");

  try {
    const client = await pool.connect();

    // Add columns to bill table
    console.log("📝 Adding image fields to bill table...");
    await client.query(`
      ALTER TABLE bill 
      ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
      ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
    `);
    console.log("✅ Bill table updated\n");

    // Add columns to government_content table
    console.log("📝 Adding image fields to government_content table...");
    await client.query(`
      ALTER TABLE government_content 
      ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
      ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
    `);
    console.log("✅ Government content table updated\n");

    // Add columns to court_case table
    console.log("📝 Adding image fields to court_case table...");
    await client.query(`
      ALTER TABLE court_case 
      ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
      ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
    `);
    console.log("✅ Court case table updated\n");

    client.release();

    console.log("🎉 All migrations completed successfully!");
    console.log("\nNew columns added:");
    console.log("  - thumbnail_url (TEXT) - stores the main image URL");
    console.log(
      "  - images (JSONB) - stores array of image objects with metadata",
    );
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
