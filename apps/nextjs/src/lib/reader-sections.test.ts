import assert from "node:assert/strict";
import test from "node:test";

import { readerSections, sectionId } from "./reader-sections";

const full = {
  unknowns: ["one open question"],
  deepDive: { title: "t", dek: "d", body: "b" },
  reading: [],
};

void test("a full brief lists every block in reading order", () => {
  assert.deepEqual(
    readerSections({ brief: full, hasLens: true }).map((s) => s.label),
    [
      "The short version",
      "What would change",
      "Who it lands on",
      "What the text doesn't settle",
      "How people make the case",
      "Keep reading",
    ],
  );
});

void test("blocks a record does not have are left out of the list", () => {
  const labels = readerSections({
    brief: { unknowns: [], reading: [] },
    hasLens: false,
  }).map((s) => s.label);
  assert.deepEqual(labels, [
    "The short version",
    "What would change",
    "Who it lands on",
  ]);
});

void test("a record without a brief lists the explainer and, if present, the lens", () => {
  assert.deepEqual(
    readerSections({ brief: null, hasLens: true }).map((s) => s.label),
    ["Plain explainer", "How people make the case"],
  );
  assert.deepEqual(readerSections({ brief: null, hasLens: false }), []);
});

void test("ids are stable, prefixed and shared by the heading and the link", () => {
  assert.equal(sectionId("what-would-change"), "section-what-would-change");
  const [first] = readerSections({ brief: full, hasLens: false });
  assert.equal(first?.id, "section-short-version");
});
