import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTitle } from "../utils/normalize-title.js";
import { applyDuplicateBudget } from "./federalregister.js";

const counts = (entries: [string, number][]) =>
  new Map(entries.map(([title, n]) => [normalizeTitle(title), n]));

void test("a document whitehouse.gov already published is skipped", () => {
  const { kept, skipped } = applyDuplicateBudget(
    [{ title: "Ending Birth Tourism" }],
    counts([["Ending Birth Tourism", 1]]),
  );

  assert.deepEqual(kept, []);
  assert.equal(skipped.length, 1);
});

void test("a document whitehouse.gov never carried is kept", () => {
  const { kept } = applyDuplicateBudget(
    [{ title: "Continuation of the National Emergency With Respect to Mali" }],
    counts([["Ending Birth Tourism", 1]]),
  );

  assert.equal(kept.length, 1);
});

void test("one stored row excuses exactly one of three identical titles", () => {
  // FR 2026-14991, -14992 and -14997 share a title, a signing date and a
  // publication date. Treating the title as covered would drop two real
  // proclamations; the budget drops only as many as are genuinely accounted
  // for.
  const title = "Imposing Additional Duties To Offset Canadian Discrimination";
  const { kept, skipped } = applyDuplicateBudget(
    [{ title }, { title }, { title }],
    counts([[title, 1]]),
  );

  assert.equal(skipped.length, 1);
  assert.equal(kept.length, 2);
});

void test("cosmetic title differences still count as covered", () => {
  const { kept } = applyDuplicateBudget(
    [{ title: "Establishing the President's Military Spouse Commission" }],
    counts([["Establishing the President’s Military Spouse Commission", 1]]),
  );

  assert.deepEqual(kept, []);
});

void test("an empty count map keeps everything", () => {
  // `countGovernmentContentTitles` returns an empty map when the query fails,
  // so this is the degraded path: a duplicate is visible and fixable, a
  // document that was never stored is indistinguishable from one never
  // published.
  const documents = [{ title: "A" }, { title: "B" }];
  const { kept, skipped } = applyDuplicateBudget(documents, new Map());

  assert.equal(kept.length, 2);
  assert.deepEqual(skipped, []);
});
