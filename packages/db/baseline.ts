import { readMigrationFiles } from "drizzle-orm/migrator";
import { Pool } from "pg";

import { loadRepoEnv } from "@acme/env/load";

loadRepoEnv();

/**
 * One-off baseline for databases that already contain the full schema because
 * it was applied with `drizzle-kit push` before we adopted generate/migrate.
 *
 * It records the two fixed adoption migrations in
 * `drizzle.__drizzle_migrations` as already-applied — using the exact table
 * shape, hash and `created_at` value that `drizzle-orm`'s migrator expects — so
 * a subsequent `pnpm db:migrate` skips them instead of trying to re-`CREATE
 * TABLE` objects that already exist. Migrations added later remain pending.
 *
 * It is idempotent: migrations already recorded are left untouched. Run it once
 * per pre-existing database (prod + any dev DB seeded via push). Brand-new
 * databases should NOT be baselined — they should just run `pnpm db:migrate`.
 */

const MIGRATIONS_FOLDER = new URL("drizzle", import.meta.url).pathname;
const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

// Existing databases adopted migration tracking after these two migrations had
// already been applied with drizzle-kit push. Keep this cutoff fixed so running
// the baseline utility in the future cannot mark a newer migration as applied.
const BASELINE_THROUGH_MILLIS = 1784735846676; // 0001_premium_famine
const EXPECTED_BASELINE_MIGRATIONS = 2;

async function baseline() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("Missing POSTGRES_URL");
  }

  // Use the non-pooling connection, matching drizzle.config.ts.
  const url = process.env.POSTGRES_URL.replace(":6543", ":5432");
  const pool = new Pool({ connectionString: url });

  try {
    const migrations = readMigrationFiles({
      migrationsFolder: MIGRATIONS_FOLDER,
    });

    const baselineMigrations = migrations.filter(
      (migration) => migration.folderMillis <= BASELINE_THROUGH_MILLIS,
    );

    if (baselineMigrations.length !== EXPECTED_BASELINE_MIGRATIONS) {
      throw new Error(
        `Expected ${EXPECTED_BASELINE_MIGRATIONS} adoption migrations through ` +
          `${BASELINE_THROUGH_MILLIS}, found ${baselineMigrations.length}. ` +
          "The initial migration history may have changed; refusing to baseline.",
      );
    }

    // Match drizzle-orm's migrator: create schema + tracking table.
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`);
    await pool.query(
      `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )`,
    );

    let inserted = 0;
    for (const migration of baselineMigrations) {
      const existing = await pool.query(
        `SELECT 1 FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" WHERE hash = $1 LIMIT 1`,
        [migration.hash],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        console.log(`✓ already recorded: ${migration.hash.slice(0, 12)}…`);
        continue;
      }
      await pool.query(
        `INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ("hash", "created_at") VALUES ($1, $2)`,
        [migration.hash, migration.folderMillis],
      );
      inserted += 1;
      console.log(`+ baselined:      ${migration.hash.slice(0, 12)}…`);
    }

    console.log(
      `\nDone. ${inserted} migration(s) marked as applied; ` +
        `${baselineMigrations.length - inserted} already present.`,
    );

    const newerMigrations = migrations.length - baselineMigrations.length;
    if (newerMigrations > 0) {
      console.log(
        `${newerMigrations} newer migration(s) left pending; run pnpm db:migrate.`,
      );
    }
  } finally {
    await pool.end();
  }
}

await baseline();
