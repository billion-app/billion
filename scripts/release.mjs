#!/usr/bin/env node
// Usage: node scripts/release.mjs [patch|minor|major] [--platform ios|android|all]
// Bumps version in apps/expo/app.config.json, runs expo prebuild --clean,
// commits the config change, and tags the release.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CONFIG_PATH = resolve(ROOT, "apps/expo/app.config.json");
const EXPO_DIR = resolve(ROOT, "apps/expo");

const BUMP_TYPES = ["patch", "minor", "major"];
const PLATFORMS = ["ios", "android", "all"];

const args = process.argv.slice(2);
const platformArg = args.find((a) => PLATFORMS.includes(a)) ?? "all";
const nonPlatformArgs = args.filter((a) => !PLATFORMS.includes(a));
const bumpType = nonPlatformArgs[0] ?? "patch";

if (!BUMP_TYPES.includes(bumpType)) {
  console.error(`Error: invalid bump type "${bumpType}". Use patch, minor, or major.`);
  process.exit(1);
}

// 1. Bump version
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const current = config.version;
if (!/^\d+\.\d+\.\d+$/.test(current)) {
  console.error(`Error: version "${current}" in app.config.json is not valid semver (expected X.Y.Z).`);
  process.exit(1);
}
const [maj, min, pat] = current.split(".").map(Number);
let next;
if (bumpType === "major") next = `${maj + 1}.0.0`;
else if (bumpType === "minor") next = `${maj}.${min + 1}.0`;
else next = `${maj}.${min}.${pat + 1}`;

config.version = next;
writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");
console.log(`Bumped ${current} → ${next}`);

// 2. Run prebuild --clean for each target platform
const targets = platformArg === "all" ? ["ios", "android"] : [platformArg];
for (const platform of targets) {
  console.log(`\nRunning expo prebuild --clean --platform ${platform}...`);
  execSync(`bunx expo prebuild --clean --platform ${platform}`, {
    cwd: EXPO_DIR,
    stdio: "inherit",
  });
}

// 3. Commit app.config.json
console.log("\nCommitting version bump...");
execSync(`git add apps/expo/app.config.json`, { cwd: ROOT, stdio: "inherit" });
execSync(`git commit -m "chore: bump version to ${next}"`, { cwd: ROOT, stdio: "inherit" });

// 4. Tag
console.log(`Tagging v${next}...`);
execSync(`git tag v${next}`, { cwd: ROOT, stdio: "inherit" });

console.log(`\nDone. Version ${next} prebuilt, committed, and tagged.`);
