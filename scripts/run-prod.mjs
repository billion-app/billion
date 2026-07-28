import { spawn } from "node:child_process";

function hostname(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

const databaseHost = hostname(process.env.POSTGRES_URL);
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const apiHost = hostname(apiUrl);

if (!databaseHost) {
  console.error(
    "pnpm run prod requires a valid POSTGRES_URL in .env or .env.prod.",
  );
  process.exit(1);
}

if (
  databaseHost === "localhost" ||
  databaseHost === "127.0.0.1" ||
  databaseHost === "::1"
) {
  console.error(
    `Refusing production mode because POSTGRES_URL points to local host "${databaseHost}".`,
  );
  process.exit(1);
}

if (!apiHost) {
  console.error(
    "pnpm run prod requires a valid EXPO_PUBLIC_API_URL in .env.prod.",
  );
  process.exit(1);
}

console.warn("");
console.warn("⚠️  LOCAL APP WITH PRODUCTION DATA");
console.warn(`   Database host: ${databaseHost}`);
console.warn(`   Expo API: ${apiUrl}`);
console.warn("   Actions in the app may read or write production data.");
console.warn("");

if (process.argv.includes("--check")) {
  console.log("Production-mode configuration is valid.");
  process.exit(0);
}

const child = spawn(
  "pnpm",
  [
    "exec",
    "turbo",
    "watch",
    "dev",
    "--continue",
    "--filter=!@acme/scraper",
    "--ui=tui",
  ],
  {
    env: {
      ...process.env,
      BILLION_RUNTIME_ENV: "production",
      TURBO_UI: "true",
    },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(`Failed to start production mode: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
