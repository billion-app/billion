import assert from "node:assert/strict";
import test from "node:test";

import { compareVersions, shouldShowAppStoreUpdate } from "./app-store-update";

const input = {
  installedVersion: "1.9.0",
  systemVersion: "26.0",
  release: { version: "1.10.0", minimumOsVersion: "16.4" },
  dismissedVersion: null,
  otaVisible: false,
};

void test("compares numeric native versions with zero-padded components", () => {
  assert.equal(compareVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareVersions("2", "1.99.99"), 1);
  assert.equal(compareVersions("1.2", "1.2.0"), 0);
  assert.equal(compareVersions("1.2.0", "1.2.1"), -1);
  for (const invalid of [
    null,
    "",
    "unknown",
    "1.beta",
    "1.2.3.4",
    "1.2.3-beta",
    "-1.2",
    " 1.2",
  ]) {
    assert.equal(compareVersions(invalid, "1.0"), null);
    assert.equal(compareVersions("1.0", invalid), null);
  }
});

void test("only newer releases installable on this device show", () => {
  assert.equal(shouldShowAppStoreUpdate(input), true);
  assert.equal(
    shouldShowAppStoreUpdate({ ...input, installedVersion: "1.10.0" }),
    false,
  );
  assert.equal(
    shouldShowAppStoreUpdate({ ...input, installedVersion: "2.0.0" }),
    false,
  );
  assert.equal(
    shouldShowAppStoreUpdate({ ...input, installedVersion: null }),
    false,
  );
  assert.equal(
    shouldShowAppStoreUpdate({ ...input, systemVersion: "16.3" }),
    false,
  );
  assert.equal(
    shouldShowAppStoreUpdate({ ...input, systemVersion: "16.4" }),
    true,
  );
  assert.equal(
    shouldShowAppStoreUpdate({ ...input, systemVersion: "unknown" }),
    false,
  );
  assert.equal(shouldShowAppStoreUpdate({ ...input, release: null }), false);
});

void test("OTA takes priority and Later dismisses only the advertised release", () => {
  assert.equal(shouldShowAppStoreUpdate({ ...input, otaVisible: true }), false);
  assert.equal(
    shouldShowAppStoreUpdate({ ...input, dismissedVersion: "1.10.0" }),
    false,
  );
  assert.equal(
    shouldShowAppStoreUpdate({ ...input, dismissedVersion: "1.9.9" }),
    true,
  );
});
