#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  cancel,
  confirm as clackConfirm,
  log as clackLog,
  intro,
  isCancel,
  note,
  outro,
} from "@clack/prompts";
import yargs from "yargs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env");
const ENV_EXAMPLE_PATH = join(ROOT, ".env.example");
const IS_WINDOWS = platform() === "win32";
const PNPM = IS_WINDOWS ? "pnpm.cmd" : "pnpm";
const MIN_NODE = [22, 20, 0];
const LOCAL_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
let cachedPsql;
let searchedForPsql = false;

function log(message = "") {
  process.stdout.write(`${message}\n`);
}

function heading(message) {
  clackLog.step(message);
}

function ok(message) {
  clackLog.success(message);
}

function warn(message) {
  clackLog.warn(message);
}

function fail(message) {
  clackLog.error(message);
}

export function parseVersion(value) {
  const match = String(value).match(/v?(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function versionAtLeast(actual, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] > minimum[index]) return true;
    if (actual[index] < minimum[index]) return false;
  }
  return true;
}

export function parseEnvOutput(output) {
  const values = {};
  for (const line of String(output).split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

export function upsertEnvText(text, key, value) {
  const nextLine = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, nextLine);
  return `${text.trimEnd()}\n${nextLine}\n`;
}

export function isPlaceholder(value) {
  if (!value?.trim()) return true;
  return /^(?:supersecret|your[_-]|replace[_-]|changeme|postgres:\/\/postgres\.\[)/i.test(
    value.replace(/^['"]|['"]$/g, ""),
  );
}

function readEnvValues() {
  if (!existsSync(ENV_PATH)) return {};
  return parseEnvOutput(readFileSync(ENV_PATH, "utf8"));
}

function setEnvValue(key, value, dryRun) {
  if (dryRun) {
    log(`  [dry run] Set ${key} in .env`);
    return;
  }
  const current = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  writeFileSync(ENV_PATH, upsertEnvText(current, key, value), "utf8");
}

function parseArgs(argv) {
  const parsed = yargs(argv)
    .scriptName("pnpm onboard")
    .usage("$0 [options]")
    .option("yes", {
      alias: "y",
      type: "boolean",
      default: false,
      describe: "Confirm every automatable step",
    })
    .option("dry-run", {
      type: "boolean",
      default: false,
      describe: "Show planned work without changing files or running setup",
    })
    .option("skip-deps", {
      type: "boolean",
      default: false,
      describe: "Skip pnpm install",
    })
    .option("skip-postgres", {
      type: "boolean",
      default: false,
      describe: "Skip Docker/Postgres/schema setup",
    })
    .option("skip-expo", {
      type: "boolean",
      default: false,
      describe: "Skip iOS and Android native setup",
    })
    .strict()
    .help()
    .parseSync();
  return {
    yes: parsed.yes,
    dryRun: parsed.dryRun,
    skipDeps: parsed.skipDeps,
    skipPostgres: parsed.skipPostgres,
    skipExpo: parsed.skipExpo,
  };
}

function commandResult(command, args = [], options = {}) {
  if (options.dryRun) {
    log(`  [dry run] ${command} ${args.join(" ")}`);
    return { status: 0, stdout: "", stderr: "" };
  }
  return spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    shell: false,
    env: process.env,
  });
}

function commandAvailable(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "pipe",
    shell: false,
  });
  return result.status === 0;
}

function dockerReady() {
  return commandAvailable("docker", ["info"]);
}

async function waitForDocker(seconds = 60) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 2) {
    if (dockerReady()) return true;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
    process.stdout.write(".");
  }
  log();
  return false;
}

function findMacContainerApp() {
  for (const app of ["OrbStack", "Docker"]) {
    if (existsSync(`/Applications/${app}.app`)) return app;
  }
  return null;
}

async function createPrompter(options) {
  return {
    async confirm(question, defaultValue = true) {
      if (options.yes) {
        clackLog.info(`${question} yes (--yes)`);
        return true;
      }
      if (!process.stdin.isTTY) {
        warn(
          `${question} skipped (non-interactive input; pass --yes to approve)`,
        );
        return false;
      }
      const answer = await clackConfirm({
        message: question,
        initialValue: defaultValue,
      });
      if (isCancel(answer)) {
        cancel("Onboarding cancelled.");
        process.exit(0);
      }
      return answer;
    },
    close() {},
  };
}

async function ensureDependencies(options, prompt, unresolved) {
  heading("1. Toolchain and dependencies");

  const nodeVersion = parseVersion(process.version);
  if (!nodeVersion || !versionAtLeast(nodeVersion, MIN_NODE)) {
    fail(
      `Node ${MIN_NODE.join(".")} or newer is required; found ${process.version}.`,
    );
    unresolved.push("Install Node >=22.20.0, then rerun pnpm onboard.");
    return false;
  }
  ok(`Node ${process.version}`);

  if (!commandAvailable(PNPM)) {
    fail("pnpm is not installed or not on PATH.");
    log(
      "  Install it from https://pnpm.io/installation, then rerun this script.",
    );
    unresolved.push("Install pnpm >=10.15.1.");
    return false;
  }

  const pnpmVersionResult = commandResult(PNPM, ["--version"], {
    capture: true,
  });
  const pnpmVersion = pnpmVersionResult.stdout.trim();
  ok(`pnpm ${pnpmVersion}`);
  if (!versionAtLeast(parseVersion(pnpmVersion) ?? [0, 0, 0], [10, 15, 1])) {
    fail("pnpm >=10.15.1 is required.");
    unresolved.push("Upgrade pnpm to >=10.15.1.");
    return false;
  }
  if (pnpmVersion !== "10.15.1") {
    warn(
      "package.json pins pnpm 10.15.1; your newer pnpm may rewrite lockfile metadata.",
    );
  }

  if (options.skipDeps) {
    warn("Dependency installation skipped by flag.");
    return existsSync(join(ROOT, "node_modules"));
  }

  const installed = existsSync(join(ROOT, "node_modules", ".pnpm"));
  const shouldInstall = !installed
    ? await prompt.confirm("Install workspace dependencies with pnpm install?")
    : await prompt.confirm(
        "Refresh workspace dependencies with pnpm install?",
        false,
      );
  if (shouldInstall) {
    const result = commandResult(PNPM, ["install"], options);
    if (result.status !== 0) {
      fail(
        "pnpm install failed. Resolve the output above and rerun onboarding.",
      );
      unresolved.push("Run pnpm install successfully.");
      return false;
    }
    ok("Workspace dependencies installed.");
  } else if (!installed) {
    unresolved.push("Run pnpm install.");
    return false;
  } else {
    ok("Existing node_modules kept.");
  }
  return true;
}

async function ensureEnv(options, prompt) {
  heading("2. Local environment file");

  if (!existsSync(ENV_PATH)) {
    if (await prompt.confirm("Create .env from .env.example?")) {
      if (options.dryRun) log("  [dry run] Copy .env.example to .env");
      else writeFileSync(ENV_PATH, readFileSync(ENV_EXAMPLE_PATH, "utf8"));
      ok("Created .env (gitignored). ");
    } else {
      warn("No .env created; app and database commands will need one.");
      return;
    }
  } else {
    ok("Existing .env preserved.");
  }

  const env = readEnvValues();
  if (isPlaceholder(env.BETTER_AUTH_SECRET)) {
    if (await prompt.confirm("Generate a local BETTER_AUTH_SECRET?")) {
      setEnvValue(
        "BETTER_AUTH_SECRET",
        randomBytes(32).toString("base64url"),
        options.dryRun,
      );
      ok("Configured BETTER_AUTH_SECRET.");
    }
  } else {
    ok("BETTER_AUTH_SECRET is already configured.");
  }

  log("  Optional provider keys can be added later; see docs/launch.md.");
}

async function tryStartDocker(options, prompt) {
  if (!commandAvailable("docker")) {
    fail("A Docker-compatible container runtime is not installed.");
    log(
      "  Install Docker Desktop, OrbStack, Rancher Desktop, Podman, or Colima:",
    );
    log("  https://docs.docker.com/get-started/get-docker/");
    return false;
  }
  if (dockerReady()) {
    ok("Docker daemon is running.");
    return true;
  }

  warn("Docker is installed but its daemon is not running.");
  if (platform() === "darwin") {
    const app = findMacContainerApp();
    if (app && (await prompt.confirm(`Open ${app} now?`))) {
      const result = commandResult("open", ["-a", app], options);
      if (options.dryRun) return true;
      if (result.status === 0 && !options.dryRun) {
        process.stdout.write("  Waiting for Docker");
        if (await waitForDocker()) {
          log();
          ok(`${app} is ready.`);
          return true;
        }
      }
    }
  } else if (platform() === "linux") {
    if (await prompt.confirm("Try to start Docker with systemctl?")) {
      commandResult("sudo", ["systemctl", "start", "docker"], options);
      if (dockerReady() || options.dryRun) return true;
    }
  }

  fail("Start your Docker-compatible runtime, then rerun onboarding.");
  return false;
}

function postgresRunning() {
  const result = commandResult(
    "docker",
    ["compose", "ps", "--status", "running", "--services"],
    {
      capture: true,
    },
  );
  return (
    result.status === 0 && result.stdout.split(/\r?\n/).includes("postgres")
  );
}

async function waitForPostgres(seconds = 60) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 2) {
    const result = commandResult(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        "postgres",
        "-d",
        "postgres",
      ],
      { capture: true },
    );
    if (result.status === 0) return true;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
    process.stdout.write(".");
  }
  log();
  return false;
}

function findPsql() {
  if (searchedForPsql) return cachedPsql;
  searchedForPsql = true;
  const candidates = new Set([
    "psql",
    "/Applications/Postgres.app/Contents/Versions/latest/bin/psql",
    "/opt/homebrew/opt/libpq/bin/psql",
    "/usr/local/opt/libpq/bin/psql",
  ]);
  if (commandAvailable("brew", ["--version"])) {
    for (const formula of [
      "postgresql",
      "postgresql@17",
      "postgresql@16",
      "postgresql@15",
      "libpq",
    ]) {
      const prefix = commandResult("brew", ["--prefix", formula], {
        capture: true,
      });
      if (prefix.status === 0) {
        candidates.add(join(prefix.stdout.trim(), "bin", "psql"));
      }
    }
  }
  for (const candidate of candidates) {
    if (commandAvailable(candidate, ["--version"])) {
      cachedPsql = candidate;
      return cachedPsql;
    }
  }
  cachedPsql = null;
  return cachedPsql;
}

export function isLocalDatabaseUrl(value) {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

async function databasePortReachable(value, timeoutMs = 750) {
  try {
    const url = new URL(value);
    const port = Number(url.port || 5432);
    return await new Promise((resolvePromise) => {
      const socket = createConnection({ host: url.hostname, port });
      const finish = (reachable) => {
        socket.destroy();
        resolvePromise(reachable);
      };
      socket.setTimeout(timeoutMs);
      socket.once("connect", () => finish(true));
      socket.once("timeout", () => finish(false));
      socket.once("error", () => finish(false));
    });
  } catch {
    return false;
  }
}

function detectSystemPostgres() {
  const psql = findPsql();
  if (!psql) return null;

  const query =
    "select current_user || '|' || current_database() || '|' || current_setting('port');";
  for (const databaseArgs of [[], ["-d", "postgres"]]) {
    const socketResult = commandResult(
      psql,
      [...databaseArgs, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", query],
      { capture: true },
    );
    if (socketResult.status !== 0) continue;

    const [user, database, port] = socketResult.stdout.trim().split("|");
    if (!user || !database || !port) continue;
    const url = `postgresql://${encodeURIComponent(user)}@127.0.0.1:${port}/${encodeURIComponent(database)}`;
    const tcpResult = commandResult(
      psql,
      [url, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", "select 1;"],
      { capture: true },
    );
    if (tcpResult.status === 0) {
      return { psql, url, user, database };
    }
  }
  return null;
}

async function waitForSystemPostgres(seconds = 30) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 2) {
    const detected = detectSystemPostgres();
    if (detected) {
      log();
      return detected;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
    process.stdout.write(".");
  }
  log();
  return null;
}

function homebrewPostgresService() {
  if (!commandAvailable("brew", ["--version"])) return null;
  const result = commandResult("brew", ["services", "list", "--json"], {
    capture: true,
  });
  if (result.status !== 0) return null;
  try {
    const services = JSON.parse(result.stdout);
    return services
      .filter((service) => /^postgresql(?:@\d+)?$/.test(service.name))
      .sort((left, right) =>
        left.status === "started" ? -1 : right.status === "started" ? 1 : 0,
      )[0];
  } catch {
    return null;
  }
}

async function tryStartSystemPostgres(options, prompt) {
  if (platform() === "linux" && findPsql()) {
    if (
      await prompt.confirm(
        "A Postgres client is installed. Try to start the system PostgreSQL service?",
      )
    ) {
      const started = commandResult(
        "sudo",
        ["systemctl", "start", "postgresql"],
        options,
      );
      if (options.dryRun) return { url: "postgresql://localhost/postgres" };
      if (started.status === 0) {
        process.stdout.write("  Waiting for system Postgres");
        return waitForSystemPostgres();
      }
    }
    return null;
  }

  if (platform() !== "darwin") return null;

  const brewService = homebrewPostgresService();
  if (brewService && brewService.status !== "started") {
    if (
      await prompt.confirm(
        `Homebrew ${brewService.name} is installed but stopped. Start it now?`,
      )
    ) {
      const started = commandResult(
        "brew",
        ["services", "start", brewService.name],
        options,
      );
      if (options.dryRun) return { url: "postgresql://localhost/postgres" };
      if (started.status === 0) {
        process.stdout.write("  Waiting for Homebrew Postgres");
        return waitForSystemPostgres();
      }
    }
  }

  if (existsSync("/Applications/Postgres.app")) {
    if (await prompt.confirm("Postgres.app is installed. Open it now?")) {
      const started = commandResult("open", ["-a", "Postgres"], options);
      if (options.dryRun) return { url: "postgresql://localhost/postgres" };
      if (started.status === 0) {
        process.stdout.write("  Waiting for Postgres.app");
        return waitForSystemPostgres();
      }
    }
  }

  return null;
}

async function applyLocalSchema(
  databaseUrl,
  label,
  options,
  prompt,
  unresolved,
  dependenciesReady,
) {
  setEnvValue("POSTGRES_URL", databaseUrl, options.dryRun);
  ok(`Configured POSTGRES_URL for ${label}.`);

  if (!dependenciesReady) {
    unresolved.push("Install dependencies before applying the Drizzle schema.");
    return;
  }

  if (await prompt.confirm("Apply the Drizzle schema to this database?")) {
    const pushed = commandResult(PNPM, ["db:push"], options);
    if (pushed.status !== 0) {
      fail("Drizzle schema push failed.");
      unresolved.push("Run pnpm db:push after fixing the reported error.");
      return;
    }
    ok("Database schema is up to date.");
  }

  if (
    await prompt.confirm(
      "Seed sample feed content for local development?",
      false,
    )
  ) {
    const seeded = commandResult(PNPM, ["-F", "@acme/db", "seed"], options);
    if (seeded.status !== 0) {
      fail("Sample-data seed failed.");
      unresolved.push("Run pnpm -F @acme/db seed after fixing the error.");
    } else {
      ok("Sample content seeded.");
    }
  }
}

async function ensurePostgres(options, prompt, unresolved, dependenciesReady) {
  heading("3. Local Postgres and schema");
  if (options.skipPostgres) {
    warn("Postgres setup skipped by flag.");
    return;
  }

  if (!existsSync(ENV_PATH) && !options.dryRun) {
    fail("A .env file is required before selecting a database.");
    unresolved.push("Create .env from .env.example, then rerun onboarding.");
    return;
  }

  const existingUrl = readEnvValues().POSTGRES_URL;
  if (!isPlaceholder(existingUrl)) {
    if (!isLocalDatabaseUrl(existingUrl)) {
      warn("The existing POSTGRES_URL appears to be remote.");
      warn(
        "Onboarding will not push a schema to it or replace it automatically.",
      );
      if (options.yes) {
        unresolved.push(
          "Rerun interactively to choose whether to keep or replace the remote POSTGRES_URL.",
        );
        return;
      }
      if (
        await prompt.confirm(
          "Keep the remote POSTGRES_URL and skip local database setup?",
        )
      ) {
        ok("Remote database configuration preserved without modification.");
        return;
      }
    } else {
      const reachable =
        options.dryRun || (await databasePortReachable(existingUrl));
      if (!reachable) {
        warn("The existing local POSTGRES_URL is not currently reachable.");
      } else if (
        await prompt.confirm(
          "Use the existing local POSTGRES_URL already configured in .env?",
        )
      ) {
        ok("Keeping the existing database connection.");
        await applyLocalSchema(
          existingUrl,
          "the existing Postgres database",
          options,
          prompt,
          unresolved,
          dependenciesReady,
        );
        return;
      }
    }
  }

  let systemPostgres = detectSystemPostgres();
  if (!systemPostgres) {
    systemPostgres = await tryStartSystemPostgres(options, prompt);
  }
  if (systemPostgres?.url) {
    if (
      await prompt.confirm(
        `Use the detected system Postgres at ${systemPostgres.url}?`,
      )
    ) {
      await applyLocalSchema(
        systemPostgres.url,
        "system Postgres",
        options,
        prompt,
        unresolved,
        dependenciesReady,
      );
      return;
    }
  }

  log("  No usable system Postgres was selected; Docker is the fallback.");
  if (!(await tryStartDocker(options, prompt))) {
    unresolved.push(
      "Start Docker, Postgres.app, or a Homebrew Postgres service, then rerun onboarding.",
    );
    return;
  }

  if (!commandAvailable("docker", ["compose", "version"])) {
    fail("Docker Compose is not available.");
    log(
      "  Install the Docker Compose plugin: https://docs.docker.com/compose/install/",
    );
    unresolved.push("Install Docker Compose.");
    return;
  }

  if (!postgresRunning() && !options.dryRun) {
    if (!(await prompt.confirm("Start the local Postgres container now?"))) {
      unresolved.push("Start Postgres with pnpm postgres:start.");
      return;
    }

    log("  The first start downloads the pinned Postgres image.");
    const started = commandResult(
      "docker",
      ["compose", "up", "-d", "postgres"],
      options,
    );
    if (started.status !== 0) {
      fail("The local Postgres container failed to start.");
      unresolved.push(
        "Resolve Docker Compose output and run pnpm postgres:start.",
      );
      return;
    }

    process.stdout.write("  Waiting for Postgres");
    if (!(await waitForPostgres())) {
      fail("Postgres did not become ready within 60 seconds.");
      unresolved.push("Inspect pnpm postgres:logs.");
      return;
    }
    log();
    ok("Local Postgres is ready.");
  } else if (options.dryRun) {
    commandResult("docker", ["compose", "up", "-d", "postgres"], options);
  } else {
    ok("Local Postgres is already running.");
  }

  await applyLocalSchema(
    LOCAL_DATABASE_URL,
    "Docker Postgres",
    options,
    prompt,
    unresolved,
    dependenciesReady,
  );
}

function iosReady() {
  return (
    platform() === "darwin" &&
    commandAvailable("xcodebuild", ["-version"]) &&
    commandAvailable("xcrun", ["simctl", "list", "devices", "available"])
  );
}

function androidReady() {
  const androidHome =
    process.env.ANDROID_HOME ??
    process.env.ANDROID_SDK_ROOT ??
    join(homedir(), "Library", "Android", "sdk");
  return existsSync(androidHome) && commandAvailable("java", ["-version"]);
}

async function runPrebuild(target, options, prompt, unresolved) {
  const nativeDir = join(ROOT, "apps", "expo", target);
  if (existsSync(nativeDir)) {
    warn(`apps/expo/${target} already exists and --clean will regenerate it.`);
  }
  if (
    !(await prompt.confirm(`Run a clean Expo ${target} prebuild now?`, false))
  ) {
    return;
  }

  const result = commandResult(
    PNPM,
    [
      "--dir",
      "apps/expo",
      "exec",
      "expo",
      "prebuild",
      "--platform",
      target,
      "--clean",
    ],
    options,
  );
  if (result.status !== 0) {
    fail(`Expo ${target} prebuild failed.`);
    unresolved.push(
      `Rerun the ${target} prebuild after fixing its prerequisites.`,
    );
    return;
  }

  if (target === "ios") {
    const patched = commandResult(
      process.execPath,
      ["scripts/patch-pbxproj.mjs"],
      options,
    );
    if (patched.status !== 0) {
      unresolved.push("Run node scripts/patch-pbxproj.mjs.");
      return;
    }
  }
  ok(`Expo ${target} native project generated.`);
}

async function ensureExpo(options, prompt, unresolved, dependenciesReady) {
  heading("5. Expo native development");
  if (options.skipExpo) {
    warn("Expo setup skipped by flag.");
    return;
  }
  if (!dependenciesReady) {
    warn("Expo prebuild requires workspace dependencies first.");
    unresolved.push("Install dependencies before running an Expo prebuild.");
    return;
  }

  if (platform() === "darwin") {
    if (await prompt.confirm("Set up the iOS native project?", false)) {
      if (!iosReady()) {
        fail(
          "Xcode, its command-line tools, and an iOS Simulator are required.",
        );
        log("  https://docs.expo.dev/workflow/ios-simulator/");
        unresolved.push("Finish Xcode/iOS Simulator setup.");
      } else {
        ok("Xcode and iOS Simulator tooling detected.");
        if (!commandAvailable("pod", ["--version"])) {
          warn("CocoaPods was not found; Expo may ask you to install it.");
          log("  Install with: brew install cocoapods");
        }
        await runPrebuild("ios", options, prompt, unresolved);
      }
    }
  } else {
    log(
      "  iOS local builds require macOS; use EAS or a physical-device workflow.",
    );
  }

  if (await prompt.confirm("Set up the Android native project?", false)) {
    if (!androidReady()) {
      fail("Android Studio/SDK and a compatible JDK were not detected.");
      log("  https://docs.expo.dev/workflow/android-studio-emulator/");
      unresolved.push("Finish Android Studio, SDK, emulator, and JDK setup.");
    } else {
      ok("Android SDK and Java detected.");
      await runPrebuild("android", options, prompt, unresolved);
    }
  }
}

async function ensureProviderEnv(options, prompt, dependenciesReady) {
  heading("4. App and provider environment");
  if (!dependenciesReady) {
    warn("The environment wizard requires workspace dependencies first.");
    return;
  }
  if (options.yes || options.dryRun) {
    log("  Run pnpm env:setup when you are ready to configure provider keys.");
    return;
  }
  if (
    await prompt.confirm(
      "Configure app or scraper provider variables with the environment wizard?",
      false,
    )
  ) {
    const configured = commandResult(PNPM, ["env:setup", "--file", ".env"], {
      ...options,
      capture: false,
    });
    if (configured.status > 1) {
      warn("The environment wizard did not complete; it is safe to rerun.");
    }
  } else {
    log("  Run pnpm env:setup later; it explains every key and provider URL.");
  }
}

async function finish(options, prompt, unresolved) {
  heading("6. Verification");
  if (await prompt.confirm("Run the monorepo typecheck now?", false)) {
    const checked = commandResult(PNPM, ["typecheck"], options);
    if (checked.status !== 0) unresolved.push("Fix pnpm typecheck failures.");
    else ok("Typecheck passed.");
  }

  heading("Ready for development");
  note(
    [
      "Website/API only: pnpm dev:next",
      "Website + Expo:   pnpm dev",
      "iOS build/run:     pnpm ios",
      "Android build/run: pnpm android",
      "Docker DB status:  pnpm postgres:status",
      "Docker DB logs:    pnpm postgres:logs",
      "Stop Docker DB:    pnpm postgres:stop",
      "Environment setup: pnpm env:setup",
      "Environment check: pnpm env:doctor --target all",
    ].join("\n"),
    "Commands",
  );

  if (unresolved.length > 0) {
    heading("Manual follow-ups");
    for (const item of [...new Set(unresolved)]) log(`  - ${item}`);
    process.exitCode = 1;
  } else {
    ok("Contributor environment setup is complete.");
  }
  outro(
    unresolved.length > 0
      ? "Onboarding finished with manual follow-ups."
      : "Billion is ready for development.",
  );
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    fail(error.message);
    process.exitCode = 2;
    return;
  }

  process.chdir(ROOT);
  intro("Billion contributor onboarding");
  note(
    "This script is idempotent and asks before changing your machine or repo.",
    "Safe to rerun",
  );
  if (options.dryRun)
    warn("Dry-run mode: no commands or writes will be performed.");

  const unresolved = [];
  const prompt = await createPrompter(options);
  try {
    const dependenciesReady = await ensureDependencies(
      options,
      prompt,
      unresolved,
    );
    await ensureEnv(options, prompt);
    await ensurePostgres(options, prompt, unresolved, dependenciesReady);
    await ensureProviderEnv(options, prompt, dependenciesReady);
    await ensureExpo(options, prompt, unresolved, dependenciesReady);
    await finish(options, prompt, unresolved);
  } finally {
    prompt.close();
  }
}

const entry = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (entry === import.meta.url) {
  await main();
}
