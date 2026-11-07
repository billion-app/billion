import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const root = resolve(process.argv[2] ?? ".");
const sourceFile = resolve(
  process.argv[3] ?? `${homedir()}/.config/billion/scraper.env`,
);
const image = "supabase/postgres:17.6.1.136";
const target = "billion-trial-db";
const backup = `${root}/backup`;
const sourceEnvFile = `${backup}/source-session.env`;
const source = parseEnv(readFileSync(sourceFile, "utf8"));
const sourceUrl = new URL(source.POSTGRES_URL);
if (
  sourceUrl.hostname !== "aws-1-us-east-1.pooler.supabase.com" ||
  decodeURIComponent(sourceUrl.username) !== "postgres.gltwmqkdminbyqzmfich"
) {
  throw new Error("Source must be Billion production. Inspect its host first.");
}
const installedRoot = execFileSync(
  "docker",
  [
    "inspect",
    target,
    "--format",
    '{{index .Config.Labels "com.docker.compose.project.working_dir"}}',
  ],
  { encoding: "utf8" },
).trim();
if (installedRoot !== root || !existsSync(`${root}/UPSTREAM_VERSION`)) {
  throw new Error("Destination must be the prepared Billion trial instance.");
}
const targetSql = (sql) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      target,
      "psql",
      "-XqAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
    ],
    { input: sql, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  ).trim();
if (
  targetSql(
    "SELECT count(*) FROM pg_tables WHERE schemaname IN ('public','drizzle');",
  ) !== "0"
) {
  throw new Error(
    "Destination already contains application tables. Keep it intact.",
  );
}
mkdirSync(backup, { recursive: true, mode: 0o700 });
if (
  existsSync(`${backup}/production.dump`) &&
  !existsSync(`${backup}/manifest.json`)
) {
  throw new Error(
    "A snapshot already exists. Keep the existing backup intact.",
  );
}
const pgEnv = {
  PGHOST: sourceUrl.hostname,
  PGPORT: "5432",
  PGDATABASE: sourceUrl.pathname.slice(1),
  PGUSER: decodeURIComponent(sourceUrl.username),
  PGPASSWORD: decodeURIComponent(sourceUrl.password),
  PGSSLMODE: "require",
  PGCONNECT_TIMEOUT: "15",
  PGAPPNAME: "billion-selfhost-trial-backup",
  PGOPTIONS: "-c default_transaction_read_only=on",
};
const tableCountsSql = `
SELECT format(
  'SELECT json_build_object(''table'', %L, ''rows'', count(*)) FROM %I.%I;',
  schemaname || '.' || tablename, schemaname, tablename
) FROM pg_tables WHERE schemaname IN ('public','drizzle') ORDER BY schemaname, tablename
\\gexec
`;
if (!existsSync(`${backup}/manifest.json`)) {
  writeFileSync(
    sourceEnvFile,
    Object.entries(pgEnv)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  const sourceArgs = ["run", "--rm", "--env-file", sourceEnvFile];
  const coordinator = spawn(
    "docker",
    [
      ...sourceArgs,
      "-i",
      "--entrypoint",
      "psql",
      image,
      "-XqAt",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { stdio: ["pipe", "pipe", "inherit"] },
  );
  const coordinatorDone = once(coordinator, "close");
  try {
    const snapshotReady = new Promise((resolveSnapshot, reject) => {
      let output = "";
      coordinator.on("error", reject);
      coordinator.stdout.on("data", (chunk) => {
        output += chunk.toString();
        if (output.includes("\n"))
          resolveSnapshot(output.trim().split("\n")[0]);
      });
      coordinator.on("close", () =>
        reject(new Error("Source snapshot session closed.")),
      );
    });
    coordinator.stdin.write(
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSELECT pg_export_snapshot();\n",
    );
    const snapshot = await snapshotReady;
    if (!/^[0-9A-F]+-[0-9A-F]+-[0-9]+$/i.test(snapshot)) {
      throw new Error("Unexpected source snapshot identifier.");
    }
    console.log("Taking a read-only snapshot of public and drizzle schemas.");
    execFileSync(
      "docker",
      [
        ...sourceArgs,
        "-v",
        `${backup}:/backup`,
        "--entrypoint",
        "pg_dump",
        image,
        "--format=custom",
        "--schema=public",
        "--schema=drizzle",
        "--no-owner",
        "--no-privileges",
        `--snapshot=${snapshot}`,
        "--file=/backup/production.dump",
      ],
      { stdio: "inherit", timeout: 300_000 },
    );
    chmodSync(`${backup}/production.dump`, 0o600);
    const manifestSql = `
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET TRANSACTION SNAPSHOT '${snapshot}';
${tableCountsSql}
SELECT jsonb_build_object('buckets', coalesce(jsonb_agg(b), '[]'::jsonb))
FROM (SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id) b;
SELECT jsonb_build_object('objects', coalesce(jsonb_agg(o), '[]'::jsonb))
FROM (SELECT bucket_id, name, metadata FROM storage.objects ORDER BY bucket_id, name) o;
COMMIT;
`;
    const lines = execFileSync(
      "docker",
      [
        ...sourceArgs,
        "-i",
        "--entrypoint",
        "psql",
        image,
        "-XqAt",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      { input: manifestSql, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    const records = lines
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const manifest = {
      capturedAt: new Date().toISOString(),
      sourceProject: "gltwmqkdminbyqzmfich",
      snapshot,
      tables: records.filter((row) => row.table),
      buckets: records.find((row) => row.buckets).buckets,
      objects: records.find((row) => row.objects).objects,
    };
    writeFileSync(
      `${backup}/manifest.json`,
      JSON.stringify(manifest, null, 2) + "\n",
      { mode: 0o600 },
    );
    coordinator.stdin.end("ROLLBACK;\n");
    const [code] = await coordinatorDone;
    if (code !== 0) throw new Error("Source snapshot session failed.");
    console.log(
      `Snapshot saved with ${manifest.tables.length} table counts and ${manifest.objects.length} storage objects.`,
    );
  } finally {
    if (!coordinator.stdin.destroyed) coordinator.stdin.end("ROLLBACK;\n");
    rmSync(sourceEnvFile, { force: true });
  }
}
const manifest = JSON.parse(readFileSync(`${backup}/manifest.json`, "utf8"));
if (manifest.sourceProject !== "gltwmqkdminbyqzmfich")
  throw new Error("Wrong source manifest.");
targetSql(
  "CREATE SCHEMA IF NOT EXISTS trial_api; CREATE EXTENSION IF NOT EXISTS pg_trgm;",
);
// No owners or grants from production are installed in this private instance.
execFileSync(
  "docker",
  ["cp", `${backup}/production.dump`, `${target}:/tmp/billion-production.dump`],
  { stdio: "inherit" },
);
const toc = execFileSync(
  "docker",
  ["exec", target, "pg_restore", "--list", "/tmp/billion-production.dump"],
  { encoding: "utf8" },
);
const restoreList = toc
  .split("\n")
  .filter((line) => !/ SCHEMA - public /.test(line))
  .join("\n");
writeFileSync(`${backup}/restore.list`, restoreList + "\n", { mode: 0o600 });
execFileSync("docker", [
  "cp",
  `${backup}/restore.list`,
  `${target}:/tmp/billion-restore.list`,
]);
execFileSync(
  "docker",
  [
    "exec",
    target,
    "pg_restore",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "--no-owner",
    "--no-privileges",
    "--single-transaction",
    "--exit-on-error",
    "--use-list=/tmp/billion-restore.list",
    "/tmp/billion-production.dump",
  ],
  { stdio: "inherit", timeout: 300_000 },
);
const restoredCounts = targetSql(tableCountsSql)
  .split("\n")
  .map((line) => JSON.parse(line));
const expected = new Map(manifest.tables.map((row) => [row.table, row.rows]));
const mismatches = restoredCounts.filter(
  (row) => expected.get(row.table) !== row.rows,
);
if (restoredCounts.length !== expected.size || mismatches.length) {
  throw new Error(`Restored counts differ: ${JSON.stringify(mismatches)}`);
}
targetSql("ANALYZE;");
writeFileSync(
  `${backup}/database-verified.json`,
  JSON.stringify(
    {
      verifiedAt: new Date().toISOString(),
      tables: restoredCounts,
    },
    null,
    2,
  ) + "\n",
  { mode: 0o600 },
);
console.log(
  `Verified every row count across ${expected.size} restored tables.`,
);
