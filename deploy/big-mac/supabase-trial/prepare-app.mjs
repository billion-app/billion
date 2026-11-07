import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
readFileSync(`${root}/backup/database-verified.json`);
const commit = execFileSync("git", ["-C", `${root}/app`, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (commit !== "2002ecd040f9ae69b21edb9dd5fd3594e2277936")
  throw new Error("Expected the pinned production checkout.");
if (existsSync(`${root}/app/.env.local`))
  throw new Error("Keep the existing trial app configuration.");
const password = randomBytes(24).toString("hex");
execFileSync(
  "docker",
  [
    "exec",
    "-i",
    "billion-trial-db",
    "psql",
    "-h",
    "127.0.0.1",
    "-U",
    "supabase_admin",
    "-Xq",
    "-v",
    "ON_ERROR_STOP=1",
  ],
  {
    input: `
CREATE ROLE billion_trial_app LOGIN BYPASSRLS PASSWORD '${password}';
GRANT CONNECT ON DATABASE postgres TO billion_trial_app;
GRANT USAGE ON SCHEMA public TO billion_trial_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO billion_trial_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO billion_trial_app;
`,
    stdio: ["pipe", "inherit", "inherit"],
  },
);
const env = {
  POSTGRES_URL: `postgresql://billion_trial_app:${password}@127.0.0.1:5440/postgres`,
  SUPABASE_URL: "http://127.0.0.1:8006",
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  NEXT_PUBLIC_POSTHOG_KEY: "billion-trial-disabled",
  NEXT_PUBLIC_POSTHOG_HOST: "http://127.0.0.1:3006/disabled-posthog",
  PORT: "3006",
};
const contents =
  Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") + "\n";
writeFileSync(`${root}/app/.env.local`, contents, { mode: 0o600 });
writeFileSync(`${root}/app-runtime.env`, contents, { mode: 0o600 });
console.log(
  "Trial app has a scoped database login and a new auth secret. No production integration keys copied.",
);
