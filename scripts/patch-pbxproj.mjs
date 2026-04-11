#!/usr/bin/env node
// Patches MARKETING_VERSION in project.pbxproj to match app.config.json version.
// Expo sets CFBundleShortVersionString in Info.plist but leaves MARKETING_VERSION
// in the pbxproj stale, causing Xcode's UI to show the wrong version number.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CONFIG_PATH = resolve(ROOT, "apps/expo/app.config.json");
const PBXPROJ_PATH = resolve(ROOT, "apps/expo/ios/billion.xcodeproj/project.pbxproj");

const { version } = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const pbxproj = readFileSync(PBXPROJ_PATH, "utf8");
const patched = pbxproj.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
writeFileSync(PBXPROJ_PATH, patched, "utf8");
console.log(`Patched MARKETING_VERSION → ${version}`);
