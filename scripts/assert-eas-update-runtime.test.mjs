import assert from "node:assert/strict";
import test from "node:test";

import {
  assertEasUpdateRuntime,
  BILLION_EAS_PROJECT_ID,
  parseEasJsonOutput,
} from "./assert-eas-update-runtime.mjs";

const IOS_FINGERPRINT = "18fd51f627135f20f527835429c245b9dc442cf6";

function productionBuild(overrides = {}) {
  return {
    id: "f25a8375-95e1-401d-af8b-cc935cc1bc39",
    status: "FINISHED",
    platform: "IOS",
    fingerprint: { hash: IOS_FINGERPRINT },
    updateChannel: { name: "production" },
    distribution: "STORE",
    buildProfile: "production",
    appIdentifier: "app.billion-news.billion",
    appVersion: "0.6.3",
    appBuildVersion: "31",
    runtime: { version: IOS_FINGERPRINT },
    app: { id: BILLION_EAS_PROJECT_ID },
    isForIosSimulator: false,
    ...overrides,
  };
}

test("parses JSON after the environment notice emitted by EAS", () => {
  assert.deepEqual(
    parseEasJsonOutput(
      'Environment variables loaded from EAS: EXPO_PUBLIC_API_URL.\n\n{\n  "hash": "runtime"\n}\n',
    ),
    { hash: "runtime" },
  );
});

test("accepts an OTA fingerprint matching the exact iOS store build", () => {
  assert.deepEqual(
    assertEasUpdateRuntime({
      build: productionBuild(),
      fingerprint: { hash: IOS_FINGERPRINT },
      platform: "ios",
    }),
    {
      buildId: "f25a8375-95e1-401d-af8b-cc935cc1bc39",
      appVersion: "0.6.3",
      buildVersion: "31",
      fingerprint: IOS_FINGERPRINT,
      platform: "ios",
    },
  );
});

test("accepts a matching Android production store build", () => {
  const androidFingerprint = "android-runtime";
  const build = productionBuild({
    id: "android-build-id",
    platform: "ANDROID",
    fingerprint: { hash: androidFingerprint },
    runtime: { version: androidFingerprint },
    appIdentifier: "app.billionnews.billion",
    appBuildVersion: "42",
  });

  assert.equal(
    assertEasUpdateRuntime({
      build,
      fingerprint: { hash: androidFingerprint },
      platform: "android",
    }).fingerprint,
    androidFingerprint,
  );
});

test("rejects the recurring bug: an OTA built for a different native runtime", () => {
  assert.throws(
    () =>
      assertEasUpdateRuntime({
        build: productionBuild(),
        fingerprint: { hash: "new-main-runtime" },
        platform: "ios",
      }),
    /OTA fingerprint new-main-runtime does not match target build fingerprint 18fd51f/,
  );
});

test("rejects a build for the wrong platform", () => {
  assert.throws(
    () =>
      assertEasUpdateRuntime({
        build: productionBuild(),
        fingerprint: { hash: IOS_FINGERPRINT },
        platform: "android",
      }),
    /Target build platform is IOS; expected ANDROID/,
  );
});

test("rejects builds that are not production store artifacts", () => {
  const invalidBuild = productionBuild({
    status: "IN_QUEUE",
    buildProfile: "preview",
    distribution: "INTERNAL",
    updateChannel: { name: "preview" },
  });

  assert.throws(
    () =>
      assertEasUpdateRuntime({
        build: invalidBuild,
        fingerprint: { hash: IOS_FINGERPRINT },
        platform: "ios",
      }),
    (error) => {
      assert.match(error.message, /status is IN_QUEUE; expected FINISHED/);
      assert.match(error.message, /profile is preview; expected production/);
      assert.match(error.message, /distribution is INTERNAL; expected STORE/);
      assert.match(
        error.message,
        /update channel is preview; expected production/,
      );
      return true;
    },
  );
});

test("rejects the wrong EAS project, app identifier, and iOS simulator", () => {
  const invalidBuild = productionBuild({
    app: { id: "another-project" },
    appIdentifier: "com.example.wrong",
    isForIosSimulator: true,
  });

  assert.throws(
    () =>
      assertEasUpdateRuntime({
        build: invalidBuild,
        fingerprint: { hash: IOS_FINGERPRINT },
        platform: "ios",
      }),
    (error) => {
      assert.match(error.message, /EAS project is another-project/);
      assert.match(error.message, /app identifier is com.example.wrong/);
      assert.match(error.message, /iOS simulator build/);
      return true;
    },
  );
});

test("rejects incomplete or internally inconsistent fingerprint data", () => {
  const invalidBuild = productionBuild({
    fingerprint: {},
    runtime: { version: "different-runtime" },
  });

  assert.throws(
    () =>
      assertEasUpdateRuntime({
        build: invalidBuild,
        fingerprint: {},
        platform: "ios",
      }),
    (error) => {
      assert.match(error.message, /Target build has no fingerprint hash/);
      assert.match(error.message, /Generated OTA has no fingerprint hash/);
      return true;
    },
  );
});

test("rejects a build whose runtime version disagrees with its fingerprint", () => {
  assert.throws(
    () =>
      assertEasUpdateRuntime({
        build: productionBuild({ runtime: { version: "other-runtime" } }),
        fingerprint: { hash: IOS_FINGERPRINT },
        platform: "ios",
      }),
    /runtime version other-runtime does not equal its fingerprint/,
  );
});
