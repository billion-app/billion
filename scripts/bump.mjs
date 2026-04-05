#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  const original = readFileSync(path, "utf8");
  const indent = original.match(/^(\s+)/m)?.[1] ?? "  ";
  writeFileSync(path, JSON.stringify(data, null, indent) + "\n");
}

function bumpVersion(current, type) {
  const [major, minor, patch] = current.split(".").map(Number);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  if (type === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump type: ${type}`);
}

function isValidSemver(str) {
  return /^\d+\.\d+\.\d+$/.test(str);
}

const args = process.argv.slice(2);
const gitFlag = args.includes("--git");
const positional = args.filter((a) => !a.startsWith("--"));
const bumpArg = positional[0] ?? "patch";

const rootPkgPath = resolve(root, "package.json");
const expoPkgPath = resolve(root, "apps/expo/package.json");

const rootPkg = readJson(rootPkgPath);
const expoPkg = readJson(expoPkgPath);

const currentVersion = rootPkg.version ?? "0.0.0";

let nextVersion;
if (isValidSemver(bumpArg)) {
  nextVersion = bumpArg;
} else if (["patch", "minor", "major"].includes(bumpArg)) {
  nextVersion = bumpVersion(currentVersion, bumpArg);
} else {
  console.error(`Error: invalid argument "${bumpArg}". Use patch, minor, major, or a version like 1.2.3.`);
  process.exit(1);
}

rootPkg.version = nextVersion;
expoPkg.version = nextVersion;

writeJson(rootPkgPath, rootPkg);
writeJson(expoPkgPath, expoPkg);

console.log(`${currentVersion} → ${nextVersion}`);

if (gitFlag) {
  try {
    execSync(`git add ${rootPkgPath} ${expoPkgPath}`, { stdio: "inherit" });
    execSync(`git commit -m "chore: bump version to ${nextVersion}"`, { stdio: "inherit" });
    execSync(`git tag v${nextVersion}`, { stdio: "inherit" });
    console.log(`Tagged v${nextVersion}`);
  } catch (err) {
    console.error("Git command failed.");
    process.exit(1);
  }
}
