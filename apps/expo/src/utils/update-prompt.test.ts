import assert from "node:assert/strict";
import test from "node:test";

import {
  DEV_PREVIEW_UPDATE_ID,
  resolveUpdatePrompt,
  ROLLBACK_UPDATE_ID,
  shouldForceShowBanner,
} from "./update-prompt";

const downloaded = { type: "new", updateId: "ota-2" };

void test("force preview shows without a real OTA", () => {
  const decision = resolveUpdatePrompt({
    forcePreview: true,
    updatesEnabled: false,
    isUpdatePending: false,
    dismissedUpdateId: null,
  });
  assert.deepEqual(decision, {
    visible: true,
    updateId: DEV_PREVIEW_UPDATE_ID,
  });
});

void test("dismissing the preview hides it for that session", () => {
  const decision = resolveUpdatePrompt({
    forcePreview: true,
    updatesEnabled: false,
    isUpdatePending: false,
    dismissedUpdateId: DEV_PREVIEW_UPDATE_ID,
  });
  assert.equal(decision.visible, false);
});

void test("disabled expo-updates never shows a real prompt", () => {
  const decision = resolveUpdatePrompt({
    forcePreview: false,
    updatesEnabled: false,
    isUpdatePending: true,
    downloadedUpdate: downloaded,
    currentlyRunningUpdateId: "ota-1",
    dismissedUpdateId: null,
  });
  assert.deepEqual(decision, { visible: false, updateId: null });
});

void test("pending with no downloaded update does not invent an id", () => {
  const decision = resolveUpdatePrompt({
    forcePreview: false,
    updatesEnabled: true,
    isUpdatePending: true,
    dismissedUpdateId: null,
  });
  assert.deepEqual(decision, { visible: false, updateId: null });
});

void test("pending with an empty downloaded id stays hidden", () => {
  const decision = resolveUpdatePrompt({
    forcePreview: false,
    updatesEnabled: true,
    isUpdatePending: true,
    downloadedUpdate: { type: "new", updateId: "  " },
    currentlyRunningUpdateId: "ota-1",
    dismissedUpdateId: null,
  });
  assert.deepEqual(decision, { visible: false, updateId: null });
});

void test("the already-running bundle is not a pending install", () => {
  const decision = resolveUpdatePrompt({
    forcePreview: false,
    updatesEnabled: true,
    isUpdatePending: true,
    downloadedUpdate: { type: "new", updateId: "ota-1" },
    currentlyRunningUpdateId: "ota-1",
    dismissedUpdateId: null,
  });
  assert.deepEqual(decision, { visible: false, updateId: null });
});

void test("a distinct downloaded update is ready to install", () => {
  const decision = resolveUpdatePrompt({
    forcePreview: false,
    updatesEnabled: true,
    isUpdatePending: true,
    downloadedUpdate: downloaded,
    currentlyRunningUpdateId: "ota-1",
    dismissedUpdateId: null,
  });
  assert.deepEqual(decision, { visible: true, updateId: "ota-2" });
});

void test("a rollback directive is a real pending install", () => {
  const decision = resolveUpdatePrompt({
    forcePreview: false,
    updatesEnabled: true,
    isUpdatePending: true,
    downloadedUpdate: { type: "rollback" },
    currentlyRunningUpdateId: "ota-1",
    dismissedUpdateId: null,
  });
  assert.deepEqual(decision, {
    visible: true,
    updateId: ROLLBACK_UPDATE_ID,
  });
});

void test("dismissing a real update hides that id only", () => {
  const hidden = resolveUpdatePrompt({
    forcePreview: false,
    updatesEnabled: true,
    isUpdatePending: true,
    downloadedUpdate: downloaded,
    currentlyRunningUpdateId: "ota-1",
    dismissedUpdateId: "ota-2",
  });
  assert.equal(hidden.visible, false);

  const next = resolveUpdatePrompt({
    forcePreview: false,
    updatesEnabled: true,
    isUpdatePending: true,
    downloadedUpdate: { type: "new", updateId: "ota-3" },
    currentlyRunningUpdateId: "ota-1",
    dismissedUpdateId: "ota-2",
  });
  assert.deepEqual(next, { visible: true, updateId: "ota-3" });
});

void test("not pending never shows", () => {
  const decision = resolveUpdatePrompt({
    forcePreview: false,
    updatesEnabled: true,
    isUpdatePending: false,
    downloadedUpdate: downloaded,
    currentlyRunningUpdateId: "ota-1",
    dismissedUpdateId: null,
  });
  assert.deepEqual(decision, { visible: false, updateId: null });
});

void test("the env preview flag is development-only", () => {
  assert.equal(shouldForceShowBanner({ isDev: true, forceEnv: "1" }), true);
  assert.equal(shouldForceShowBanner({ isDev: false, forceEnv: "1" }), false);
  assert.equal(
    shouldForceShowBanner({ forceShowProp: true, isDev: false }),
    true,
  );
});
