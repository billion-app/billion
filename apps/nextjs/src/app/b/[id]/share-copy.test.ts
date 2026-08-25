import assert from "node:assert/strict";
import test from "node:test";

import {
  contentIdFromSegment,
  plainText,
  presentType,
  shareSegment,
  shareSummary,
  truncate,
} from "./share-copy";

const ID = "a1b2c3d4-1111-2222-3333-444455556666";

/* ---------- reading an id out of a URL ---------- */

void test("a bare id is read as itself", () => {
  assert.equal(contentIdFromSegment(ID), ID);
});

void test("the id is read out of a slugged segment", () => {
  assert.equal(contentIdFromSegment(`emergency-care-act-${ID}`), ID);
});

void test("a stale slug still resolves, because only the id is read", () => {
  // The title this link was shared under has since been corrected.
  assert.equal(contentIdFromSegment(`some-old-title-${ID}`), ID);
});

void test("an id is normalised, because URLs get lowercased in transit", () => {
  assert.equal(contentIdFromSegment(ID.toUpperCase()), ID);
});

void test("a segment naming no id resolves to nothing", () => {
  assert.equal(contentIdFromSegment("emergency-care-act"), null);
  assert.equal(contentIdFromSegment(""), null);
});

void test("an id that is only a prefix of the segment is refused", () => {
  // Guards against a crafted path smuggling an id past the trailing anchor.
  assert.equal(contentIdFromSegment(`${ID}-and-then-some`), null);
});

/* ---------- building one ---------- */

void test("a share segment puts a readable slug in front of the id", () => {
  assert.equal(
    shareSegment("Emergency Care Act of 2026", ID),
    `emergency-care-act-of-2026-${ID}`,
  );
});

void test("a share segment round-trips back to the id it was built from", () => {
  assert.equal(
    contentIdFromSegment(shareSegment("H.R. 4821 — Emergency Care!", ID)),
    ID,
  );
});

void test("a title with no usable characters falls back to the bare id", () => {
  assert.equal(shareSegment("— · —", ID), ID);
});

void test("a truncated slug leaves no trailing separator before the id", () => {
  const segment = shareSegment("a".repeat(60) + " tail", ID);
  assert.ok(!segment.includes("--"), segment);
  assert.equal(contentIdFromSegment(segment), ID);
});

/* ---------- copy ---------- */

void test("brief emphasis markers are unwrapped, not shown", () => {
  assert.equal(
    plainText("Hospitals would **repay three years** of funding."),
    "Hospitals would repay three years of funding.",
  );
});

void test("prose without markers is left alone", () => {
  assert.equal(plainText("  No markers here.  "), "No markers here.");
});

void test("text within the limit is not truncated", () => {
  assert.equal(truncate("short", 20), "short");
});

void test("truncation cuts on a word boundary", () => {
  assert.equal(truncate("one two three four", 14), "one two three…");
});

void test("truncation hard-cuts rather than losing most of the limit", () => {
  // The last space sits at 7 of 12, below the 60% a boundary is worth.
  assert.equal(truncate("one two three four", 12), "one two thre…");
});

void test("a single long token cannot collapse a truncation", () => {
  const result = truncate(`a ${"b".repeat(40)}`, 20);
  assert.equal(result.length, 21);
  assert.ok(result.endsWith("…"));
});

/* ---------- type presentation ---------- */

void test("every content type the app knows has a badge", () => {
  assert.equal(presentType("bill").label, "BILL");
  assert.equal(presentType("government_content").label, "ORDER");
  assert.equal(presentType("court_case").label, "CASE");
});

void test("an unknown content type falls back instead of throwing", () => {
  assert.equal(presentType("something_new").label, "NEWS");
});

/* ---------- what a share says ---------- */

const record = {
  id: ID,
  type: "bill",
  title: "Emergency Care Act",
  description: "The scraped description.",
};

void test("a share prefers the brief's purpose-written summary", () => {
  assert.equal(
    shareSummary({ ...record, brief: { summary: "The **real** takeaway." } }),
    "The real takeaway.",
  );
});

void test("a record with no brief falls back to its description", () => {
  assert.equal(shareSummary(record), "The scraped description.");
});

void test("a brief predating summaries falls back to the description", () => {
  assert.equal(
    shareSummary({ ...record, brief: { hook: "…" } }),
    record.description,
  );
});
