import assert from "node:assert/strict";
import test from "node:test";

import { extractFormattedBillText } from "./congress.js";

void test("formatted bill text is normalized without a word-count cap", () => {
  const words = Array.from({ length: 1_250 }, (_, index) => `word${index + 1}`);
  const normalized = extractFormattedBillText(
    `<html><body><p>${words.join(" ")}</p></body></html>`,
  );

  assert.ok(normalized);
  assert.equal(normalized.split(/\s+/).length, 1_250);
  assert.match(normalized, /word1250$/);
});

void test("empty formatted bill text stays optional", () => {
  assert.equal(
    extractFormattedBillText("<html><body> </body></html>"),
    undefined,
  );
});
