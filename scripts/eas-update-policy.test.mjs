import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

test("main publishes Expo updates to preview, never production", () => {
  const ci = read(".github/workflows/ci.yml");

  assert.match(ci, /eas-update-preview:/);
  assert.match(ci, /--channel preview/);
  assert.doesNotMatch(ci, /--channel production/);
});

test("production OTA publishing is manual and follows the runtime guard", () => {
  const release = read(".github/workflows/release-ota.yml");
  const guardIndex = release.indexOf("- name: Assert runtime compatibility");
  const publishIndex = release.indexOf("- name: Publish production update");

  assert.match(release, /workflow_dispatch:/);
  assert.match(
    release,
    /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/,
  );
  assert.match(release, /assert-eas-update-runtime\.mjs/);
  assert.match(release, /--channel production/);
  assert.ok(guardIndex >= 0, "runtime guard step is missing");
  assert.ok(
    publishIndex > guardIndex,
    "production publish must follow the guard",
  );
});

test("preview has both physical-device and simulator build profiles", () => {
  const eas = JSON.parse(read("apps/expo/eas.json"));

  assert.equal(eas.build.preview.channel, "preview");
  assert.equal(eas.build.preview.distribution, "internal");
  assert.equal(eas.build.preview.ios, undefined);
  assert.equal(eas.build["preview-simulator"].extends, "preview");
  assert.equal(eas.build["preview-simulator"].ios.simulator, true);
});
