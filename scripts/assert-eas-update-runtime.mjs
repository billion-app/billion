#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const BILLION_EAS_PROJECT_ID = "c38bc8f8-f82c-4a45-b819-d62bd366ac8b";

const APP_IDENTIFIERS = {
  android: "app.billionnews.billion",
  ios: "app.billion-news.billion",
};

function printable(value) {
  return typeof value === "string" && value.length > 0 ? value : "missing";
}

export function assertEasUpdateRuntime({ build, fingerprint, platform }) {
  const normalizedPlatform = String(platform).toLowerCase();
  const expectedAppIdentifier = APP_IDENTIFIERS[normalizedPlatform];

  if (!expectedAppIdentifier) {
    throw new Error(
      `Unsupported platform ${platform}; expected ios or android.`,
    );
  }

  const errors = [];
  const expectedBuildPlatform = normalizedPlatform.toUpperCase();
  const targetFingerprint = build?.fingerprint?.hash;
  const targetRuntime = build?.runtime?.version;
  const updateFingerprint = fingerprint?.hash;

  if (build?.status !== "FINISHED") {
    errors.push(
      `Target build status is ${printable(build?.status)}; expected FINISHED.`,
    );
  }
  if (build?.buildProfile !== "production") {
    errors.push(
      `Target build profile is ${printable(build?.buildProfile)}; expected production.`,
    );
  }
  if (build?.distribution !== "STORE") {
    errors.push(
      `Target build distribution is ${printable(build?.distribution)}; expected STORE.`,
    );
  }
  if (build?.updateChannel?.name !== "production") {
    errors.push(
      `Target build update channel is ${printable(build?.updateChannel?.name)}; expected production.`,
    );
  }
  if (build?.platform !== expectedBuildPlatform) {
    errors.push(
      `Target build platform is ${printable(build?.platform)}; expected ${expectedBuildPlatform}.`,
    );
  }
  if (build?.app?.id !== BILLION_EAS_PROJECT_ID) {
    errors.push(
      `Target build EAS project is ${printable(build?.app?.id)}; expected ${BILLION_EAS_PROJECT_ID}.`,
    );
  }
  if (build?.appIdentifier !== expectedAppIdentifier) {
    errors.push(
      `Target build app identifier is ${printable(build?.appIdentifier)}; expected ${expectedAppIdentifier}.`,
    );
  }
  if (normalizedPlatform === "ios" && build?.isForIosSimulator !== false) {
    errors.push(
      "Target build is an iOS simulator build; expected a device build.",
    );
  }
  if (!targetFingerprint) {
    errors.push("Target build has no fingerprint hash.");
  }
  if (!targetRuntime) {
    errors.push("Target build has no runtime version.");
  }
  if (!updateFingerprint) {
    errors.push("Generated OTA has no fingerprint hash.");
  }
  if (
    targetFingerprint &&
    targetRuntime &&
    targetRuntime !== targetFingerprint
  ) {
    errors.push(
      `Target build runtime version ${targetRuntime} does not equal its fingerprint ${targetFingerprint}.`,
    );
  }
  if (
    targetFingerprint &&
    updateFingerprint &&
    updateFingerprint !== targetFingerprint
  ) {
    errors.push(
      `OTA fingerprint ${updateFingerprint} does not match target build fingerprint ${targetFingerprint}.`,
    );
  }

  if (errors.length > 0) {
    const buildId = printable(build?.id);
    throw new Error(
      [
        "Production OTA compatibility check failed:",
        ...errors.map((error) => `- ${error}`),
        "",
        "No update was published. Build the OTA from the release commit used for",
        `target build ${buildId}, or ship a new store binary for the new runtime.`,
      ].join("\n"),
    );
  }

  return {
    buildId: build.id,
    appVersion: build.appVersion,
    buildVersion: build.appBuildVersion,
    fingerprint: targetFingerprint,
    platform: normalizedPlatform,
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || !value) {
      throw new Error(
        "Usage: assert-eas-update-runtime --build-file FILE --fingerprint-file FILE --platform ios|android",
      );
    }
    options[flag.slice(2)] = value;
  }
  return {
    buildFile: options["build-file"],
    fingerprintFile: options["fingerprint-file"],
    platform: options.platform,
  };
}

export function parseEasJsonOutput(text) {
  const output = String(text).trim();
  try {
    return JSON.parse(output);
  } catch {
    const jsonLine = output.match(/(?:^|\n)\s*[\[{]/);
    if (!jsonLine) throw new Error("EAS output did not contain JSON.");
    const openingOffset = jsonLine[0].search(/[\[{]/);
    return JSON.parse(output.slice(jsonLine.index + openingOffset));
  }
}

function readJson(path, label) {
  if (!path) throw new Error(`Missing ${label} file argument.`);
  try {
    return parseEasJsonOutput(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read ${label} JSON from ${path}: ${error.message}`,
    );
  }
}

function writeGitHubOutputs(result) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(result)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n",
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = assertEasUpdateRuntime({
    build: readJson(options.buildFile, "target build"),
    fingerprint: readJson(options.fingerprintFile, "generated fingerprint"),
    platform: options.platform,
  });

  writeGitHubOutputs(result);
  process.stdout.write(
    `Compatible ${result.platform} runtime: build ${result.buildId} ` +
      `(${result.appVersion} build ${result.buildVersion}) uses ${result.fingerprint}.\n`,
  );
}

const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainModule) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
