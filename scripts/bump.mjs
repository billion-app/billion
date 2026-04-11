#!/usr/bin/env node
// Usage: node scripts/bump.mjs [patch|minor|major]
// Bumps version in apps/expo/app.config.json and sets build numbers from git commit count.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "../apps/expo/app.config.json");

const BUMP_TYPES = ["patch", "minor", "major"];
const bumpType = process.argv[2] ?? "patch";

if (!BUMP_TYPES.includes(bumpType)) {
  console.error(`Error: invalid bump type "${bumpType}". Use patch, minor, or major.`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const current = config.version;

const [maj, min, pat] = current.split(".").map(Number);
let next;
if (bumpType === "major") next = `${maj + 1}.0.0`;
else if (bumpType === "minor") next = `${maj}.${min + 1}.0`;
else next = `${maj}.${min}.${pat + 1}`;

config.version = next;

writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");

console.log(`Bumped ${current} → ${next}`);
