#!/usr/bin/env node
// Usage: node scripts/bump.mjs [patch|minor|major]
// Bumps version in apps/expo/app.config.base.json, commits, and tags.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CONFIG_PATH = resolve(ROOT, "apps/expo/app.config.base.json");

const BUMP_TYPES = ["patch", "minor", "major"];
const bumpType = process.argv[2] ?? "patch";

if (!BUMP_TYPES.includes(bumpType)) {
  console.error(`Error: invalid bump type "${bumpType}". Use patch, minor, or major.`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const current = config.version;

if (!/^\d+\.\d+\.\d+$/.test(current)) {
  console.error(`Error: version "${current}" in app.config.base.json is not valid semver (expected X.Y.Z).`);
  process.exit(1);
}

const [maj, min, pat] = current.split(".").map(Number);
let next;
if (bumpType === "major") next = `${maj + 1}.0.0`;
else if (bumpType === "minor") next = `${maj}.${min + 1}.0`;
else next = `${maj}.${min}.${pat + 1}`;

config.version = next;
writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");

// `JSON.stringify` and Prettier disagree about short arrays — the former
// expands `["**/*"]` across three lines. Without this, every bump committed an
// unrelated reformat that failed the format check, and a red format check
// blocks `scraper-image` in CI, so a version bump could stall production
// deploys. Re-format through Prettier so the output matches what CI verifies.
execSync(`pnpm exec prettier --write ${JSON.stringify(CONFIG_PATH)}`, {
  cwd: ROOT,
  stdio: "inherit",
});

console.log(`Bumped ${current} → ${next}`);

execSync(`git add apps/expo/app.config.base.json`, { cwd: ROOT, stdio: "inherit" });
execSync(`git commit -m "chore: bump version to ${next}"`, { cwd: ROOT, stdio: "inherit" });
execSync(`git tag v${next}`, { cwd: ROOT, stdio: "inherit" });
console.log(`Tagged v${next}`);
