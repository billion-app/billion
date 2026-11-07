import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const root = resolve(process.argv[2] ?? ".");
if (!existsSync(`${root}/volumes/db/roles.sql`)) {
  throw new Error("Pass the copied upstream Docker directory.");
}
if (existsSync(`${root}/.env`)) {
  throw new Error("The trial already has credentials. Keep its existing .env.");
}
chmodSync(root, 0o700);
writeFileSync(`${root}/.env`, readFileSync(`${root}/.env.example`), {
  mode: 0o600,
});
for (const script of ["generate-keys.sh", "add-new-auth-keys.sh"]) {
  try {
    execFileSync("sh", [`utils/${script}`, "--update-env"], {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    throw new Error(`${script} failed. Inspect the private trial directory.`);
  }
}
const env = parseEnv(readFileSync(`${root}/.env`, "utf8"));
Object.assign(env, {
  COMPOSE_FILE: "docker-compose.yml:compose.override.yaml",
  SUPABASE_PUBLIC_URL: "http://127.0.0.1:8006",
  API_EXTERNAL_URL: "http://127.0.0.1:8006/auth/v1",
  SITE_URL: "http://127.0.0.1:3006",
  POOLER_TENANT_ID: "billion-trial",
  STORAGE_TENANT_ID: "billion-trial",
  STUDIO_DEFAULT_ORGANIZATION: "Billion",
  STUDIO_DEFAULT_PROJECT: "Production copy (trial)",
  // Keep the cloned application tables out of the Supabase REST API.
  PGRST_DB_SCHEMAS: "trial_api",
  DISABLE_SIGNUP: "true",
  ENABLE_EMAIL_SIGNUP: "false",
  ENABLE_PHONE_SIGNUP: "false",
  OPENAI_API_KEY: "",
  SMTP_USER: "",
  SMTP_PASS: "",
});
writeFileSync(
  `${root}/.env`,
  Object.entries(env)
    .map(([key, value]) => `${key}='${value.replaceAll("'", "\\'")}'`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
writeFileSync(
  `${root}/UPSTREAM_VERSION`,
  "self-hosted/v0.8.3\nbc27d2661edd09a5d0b8d76ce33da6d4071a756e\n",
);
console.log("Trial credentials generated. No production settings changed.");
