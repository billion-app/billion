#!/usr/bin/env node
// Usage: node scripts/bump.mjs [patch|minor|major]
// Bumps version in apps/expo/app.config.json, commits, and tags.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CONFIG_PATH = resolve(ROOT, "apps/expo/app.config.json");

const BUMP_TYPES = ["patch", "minor", "major"];
const bumpType = process.argv[2] ?? "patch";

if (!BUMP_TYPES.includes(bumpType)) {
  console.error(`Error: invalid bump type "${bumpType}". Use patch, minor, or major.`);
  process.exit(1);
}

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

execSync(`git add apps/expo/app.config.json`, { cwd: ROOT, stdio: "inherit" });
execSync(`git commit -m "chore: bump version to ${next}"`, { cwd: ROOT, stdio: "inherit" });
execSync(`git tag v${next}`, { cwd: ROOT, stdio: "inherit" });
console.log(`Tagged v${next}`);
