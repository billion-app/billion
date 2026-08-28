import assert from "node:assert/strict";
import test from "node:test";

import type { GovernmentContentTitleMatch } from "../utils/db/helpers.js";
import { normalizeTitle } from "../utils/normalize-title.js";
import { assignWhiteHouseMatches } from "./federalregister.js";

const counts = (
  entries: [string, number][],
): Map<string, GovernmentContentTitleMatch[]> =>
  new Map(
    entries.map(([title, n]) => [
      normalizeTitle(title),
      Array.from({ length: n }, (_, index) => ({
        id: `${normalizeTitle(title)}-${index}`,
        normalizedTitle: normalizeTitle(title),
        federalRegisterDocumentNumber: null,
      })),
    ]),
  );

void test("a document whitehouse.gov already published is assigned for merge", () => {
  const { unmatched, matched } = assignWhiteHouseMatches(
    [{ title: "Ending Birth Tourism" }],
    counts([["Ending Birth Tourism", 1]]),
  );

  assert.deepEqual(unmatched, []);
  assert.equal(matched.length, 1);
  assert.equal(matched[0]?.contentId, "endingbirthtourism-0");
});

void test("a document whitehouse.gov never carried is kept", () => {
  const { unmatched } = assignWhiteHouseMatches(
    [{ title: "Continuation of the National Emergency With Respect to Mali" }],
    counts([["Ending Birth Tourism", 1]]),
  );

  assert.equal(unmatched.length, 1);
});

void test("one stored row receives exactly one of three identical citations", () => {
  // FR 2026-14991, -14992 and -14997 share a title, a signing date and a
  // publication date. Treating the title as covered would drop two real
  // proclamations; the budget drops only as many as are genuinely accounted
  // for.
  const title = "Imposing Additional Duties To Offset Canadian Discrimination";
  const { unmatched, matched } = assignWhiteHouseMatches(
    [{ title }, { title }, { title }],
    counts([[title, 1]]),
  );

  assert.equal(matched.length, 1);
  assert.equal(unmatched.length, 2);
});

void test("a different citation cannot overwrite an already linked row", () => {
  const title = "Repeated title";
  const matches = counts([[title, 1]]);
  matches.get(normalizeTitle(title))![0]!.federalRegisterDocumentNumber =
    "2026-00001";

  const { unmatched, matched } = assignWhiteHouseMatches(
    [{ title, document_number: "2026-00002" }],
    matches,
  );

  assert.equal(unmatched.length, 1);
  assert.deepEqual(matched, []);
});

void test("rerunning the same citation reuses its linked row", () => {
  const title = "Repeated title";
  const matches = counts([[title, 1]]);
  matches.get(normalizeTitle(title))![0]!.federalRegisterDocumentNumber =
    "2026-00001";

  const { unmatched, matched } = assignWhiteHouseMatches(
    [{ title, document_number: "2026-00001" }],
    matches,
  );

  assert.deepEqual(unmatched, []);
  assert.equal(matched.length, 1);
});

void test("cosmetic title differences still count as covered", () => {
  const { unmatched, matched } = assignWhiteHouseMatches(
    [{ title: "Establishing the President's Military Spouse Commission" }],
    counts([["Establishing the President’s Military Spouse Commission", 1]]),
  );

  assert.deepEqual(unmatched, []);
  assert.equal(matched.length, 1);
});

void test("an empty match map keeps everything", () => {
  const documents = [{ title: "A" }, { title: "B" }];
  const { unmatched, matched } = assignWhiteHouseMatches(documents, new Map());

  assert.equal(unmatched.length, 2);
  assert.deepEqual(matched, []);
});
