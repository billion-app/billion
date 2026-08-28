import assert from "node:assert/strict";
import test from "node:test";

import { latestActionDate } from "./last-action.js";

void test("takes the newest action regardless of array order", () => {
  // congress.gov returns actions newest-first and Open States oldest-first;
  // neither order may be trusted, because the result is a sort key.
  const newestFirst = latestActionDate([
    { date: "2026-07-22" },
    { date: "2025-06-10" },
  ]);
  const oldestFirst = latestActionDate([
    { date: "2025-06-10" },
    { date: "2026-07-22" },
  ]);

  assert.equal(newestFirst?.toISOString(), "2026-07-22T00:00:00.000Z");
  assert.deepEqual(newestFirst, oldestFirst);
});

void test("undated and unparseable actions are ignored, not treated as epoch", () => {
  // Treating these as 0 would silently be "no action", but treating them as
  // the newest would drag a bill to the top of Browse on a malformed row.
  assert.equal(
    latestActionDate([
      { date: "2026-07-22" },
      { date: "" },
      { date: "not a date" },
      {},
    ])?.toISOString(),
    "2026-07-22T00:00:00.000Z",
  );
});

void test("a bill with no usable action dates yields undefined", () => {
  // The caller falls back to introducedDate; a null must not become epoch,
  // which would pin the bill to the bottom of every listing forever.
  assert.equal(latestActionDate(undefined), undefined);
  assert.equal(latestActionDate([]), undefined);
  assert.equal(latestActionDate([{}, { date: "" }]), undefined);
});

void test("full timestamps and bare dates both parse", () => {
  assert.equal(
    latestActionDate([{ date: "2026-08-07T13:45:00Z" }])?.toISOString(),
    "2026-08-07T13:45:00.000Z",
  );
  assert.equal(
    latestActionDate([{ date: "2026-08-07" }])?.toISOString(),
    "2026-08-07T00:00:00.000Z",
  );
});
