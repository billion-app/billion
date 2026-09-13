import assert from "node:assert/strict";
import test from "node:test";

import { createVisitStore, parseLeftAt } from "./visit-store";

void test("a missing or unreadable stamp is no visit", () => {
  assert.equal(parseLeftAt(null), undefined);
  assert.equal(parseLeftAt("not a date"), undefined);
});

void test("a stored ISO stamp reads back as that instant", () => {
  const at = parseLeftAt("2026-09-11T16:00:00.000Z");
  assert.equal(at?.toISOString(), "2026-09-11T16:00:00.000Z");
});

void test("marking a leave persists for the next home open", async () => {
  let value: string | null = null;
  const store = createVisitStore({
    getItem: () => Promise.resolve(value),
    setItem: (_key, next) => {
      value = next;
      return Promise.resolve();
    },
  });
  const left = new Date("2026-09-12T08:00:00.000Z");
  await store.markLeft(left);
  assert.equal((await store.read())?.toISOString(), left.toISOString());
});
