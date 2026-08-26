import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_SAVED,
  parseSavedIds,
  withoutSavedId,
  withSavedId,
} from "./saved-store";

/**
 * The saved set is the one piece with no server to fall back on — if these
 * rules are wrong, a reader's bookmarks are wrong and nothing else notices.
 */

const A = "aaaaaaaa-1111-2222-3333-444444444444";
const B = "bbbbbbbb-1111-2222-3333-444444444444";

/* ---------- reading what is on disk ---------- */

void test("a reader who has saved nothing gets an empty list", () => {
  assert.deepEqual(parseSavedIds(null), []);
  assert.deepEqual(parseSavedIds(""), []);
});

void test("a stored list reads back in order", () => {
  assert.deepEqual(parseSavedIds(JSON.stringify([A, B])), [A, B]);
});

void test("a corrupt store reads as empty rather than throwing", () => {
  assert.deepEqual(parseSavedIds("{not json"), []);
});

void test("a store holding the wrong shape reads as empty", () => {
  assert.deepEqual(parseSavedIds(JSON.stringify([1, 2, 3])), []);
  assert.deepEqual(parseSavedIds(JSON.stringify({ ids: [A] })), []);
});

/* ---------- changing it ---------- */

void test("the newest save comes first", () => {
  assert.deepEqual(withSavedId([A], B), [B, A]);
});

void test("saving the same thing twice moves it, it does not duplicate", () => {
  assert.deepEqual(withSavedId([B, A], A), [A, B]);
});

void test("the list is capped so it stays hydratable in one request", () => {
  const full = Array.from({ length: MAX_SAVED }, (_, i) => `id-${i}`);
  const next = withSavedId(full, "newest");
  assert.equal(next.length, MAX_SAVED);
  assert.equal(next[0], "newest");
  // The cap drops the oldest, never the save that was just made.
  assert.ok(!next.includes(`id-${MAX_SAVED - 1}`));
});

void test("removing takes only that id", () => {
  assert.deepEqual(withoutSavedId([B, A], B), [A]);
});

void test("removing something that was never saved is a no-op", () => {
  assert.deepEqual(withoutSavedId([A], B), [A]);
});

void test("a save then an unsave leaves the list as it started", () => {
  assert.deepEqual(withoutSavedId(withSavedId([A], B), B), [A]);
});
