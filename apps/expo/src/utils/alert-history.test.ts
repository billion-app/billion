import assert from "node:assert/strict";
import test from "node:test";

import type { AlertItem } from "./alert-history";
import {
  createAlertHistoryStore,
  formatAlertTime,
  groupAlertsByDay,
  MAX_ALERTS,
  parseAlertHistory,
  TEST_ALERT,
  withAlert,
} from "./alert-history";

const NOW = new Date(2026, 8, 16, 19, 42, 0);

function alert(
  id: string,
  at: Date,
  extra: Partial<AlertItem> = {},
): AlertItem {
  return {
    id,
    at: at.toISOString(),
    kind: "follow",
    title: "Something you follow moved.",
    body: "A bill advanced.",
    ...extra,
  };
}

void test("a missing or corrupt history reads as empty", () => {
  assert.deepEqual(parseAlertHistory(null), []);
  assert.deepEqual(parseAlertHistory("{not json"), []);
  assert.deepEqual(parseAlertHistory(JSON.stringify([{ id: 1 }])), []);
});

void test("a stored alert reads back", () => {
  const item = alert("a", NOW);
  assert.deepEqual(parseAlertHistory(JSON.stringify([item])), [item]);
});

void test("the newest alert comes first and does not duplicate", () => {
  const a = alert("a", NOW);
  const b = alert("b", NOW);
  assert.equal(withAlert([a], b)[0]?.id, "b");
  assert.equal(withAlert([a], { ...a, title: "Updated" })[0]?.title, "Updated");
  assert.equal(withAlert([a], { ...a, title: "Updated" }).length, 1);
});

void test("the list is capped so it stays hydratable", () => {
  const full = Array.from({ length: MAX_ALERTS }, (_, i) =>
    alert(`id-${i}`, NOW),
  );
  const next = withAlert(full, alert("newest", NOW));
  assert.equal(next.length, MAX_ALERTS);
  assert.equal(next[0]?.id, "newest");
});

void test("today and yesterday are labels, not dates", () => {
  const groups = groupAlertsByDay(
    [
      alert("today", NOW),
      alert("yest", new Date(2026, 8, 15, 9, 4)),
      alert("older", new Date(2026, 8, 10, 12, 0)),
    ],
    NOW,
  );
  assert.equal(groups[0]?.label, "TODAY");
  assert.equal(groups[1]?.label, "YESTERDAY");
  assert.match(groups[2]?.label ?? "", /September/);
});

void test("the test send is the signature Billion line", () => {
  assert.equal(TEST_ALERT.title, "A bill you follow advanced.");
  assert.match(TEST_ALERT.body, /what changed/i);
});

void test("old sample history is discarded", () => {
  assert.deepEqual(
    parseAlertHistory(
      JSON.stringify([alert("sample-passed", NOW), alert("real", NOW)]),
    ),
    [alert("real", NOW)],
  );
});

void test("alert times are clock stamps, not relative phrases", () => {
  assert.match(formatAlertTime(NOW), /7:42/);
});

void test("an empty store stays empty", async () => {
  let value: string | null = null;
  const store = createAlertHistoryStore({
    getItem: () => Promise.resolve(value),
    setItem: (_key, next) => {
      value = next;
      return Promise.resolve();
    },
  });
  assert.deepEqual(await store.read(), []);
  assert.equal(value, null);
});

void test("a scheduled local test is recorded", async () => {
  let value: string | null = null;
  const store = createAlertHistoryStore({
    getItem: () => Promise.resolve(value),
    setItem: (_key, next) => {
      value = next;
      return Promise.resolve();
    },
  });
  const next = await store.prepend({
    id: "test-1",
    at: NOW.toISOString(),
    ...TEST_ALERT,
  });
  assert.equal(next[0]?.id, "test-1");
  assert.equal(next.length, 1);
});
