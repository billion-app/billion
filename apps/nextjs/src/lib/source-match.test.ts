import assert from "node:assert/strict";
import test from "node:test";

import { findQuote } from "./source-match";

const TEXT = "SEC. 2. The Secretary shall issue grants. SEC. 3. Funding.";

void test("an exact quote splits the text around the passage", () => {
  assert.deepEqual(findQuote(TEXT, "The Secretary shall issue grants."), {
    found: true,
    before: "SEC. 2. ",
    match: "The Secretary shall issue grants.",
    after: " SEC. 3. Funding.",
  });
});

void test("case differences still find the passage, returning the source's own casing", () => {
  const result = findQuote(TEXT, "the secretary SHALL issue grants");
  assert.equal(result.found, true);
  assert.equal(result.match, "The Secretary shall issue grants");
});

void test("a quote that is not in the text is shown as cited, above the whole text", () => {
  assert.deepEqual(findQuote(TEXT, "not here"), {
    found: false,
    before: "",
    match: "not here",
    after: TEXT,
  });
});
