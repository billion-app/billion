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

// The pipeline accepts a quote when it matches after normalizing punctuation,
// whitespace, curly quotes and words hyphenated across line breaks
// (`normalizeForQuoteMatch` in apps/scraper). The reader must find those too.
void test("a quote verified across a line break and extra spaces is still found", () => {
  const source = "SEC. 4. The Secretary shall\n   establish a grant\nprogram.";
  const result = findQuote(
    source,
    "The Secretary shall establish a grant program.",
  );
  assert.equal(result.found, true);
  assert.equal(result.before, "SEC. 4. ");
  // Punctuation is ignored by the match, so the closing period stays outside it.
  assert.equal(
    result.match,
    "The Secretary shall\n   establish a grant\nprogram",
  );
  assert.equal(result.after, ".");
});

void test("curly quotes and a hyphenated line break still match", () => {
  const source =
    "the term ‘covered entity’ means any trans-\nportation authority. Next.";
  const result = findQuote(
    source,
    "the term 'covered entity' means any transportation authority",
  );
  assert.equal(result.found, true);
  assert.equal(
    result.match,
    "the term ‘covered entity’ means any trans-\nportation authority",
  );
  assert.equal(result.after, ". Next.");
});

void test("a character that lowercases to two keeps later matches aligned", () => {
  // "İ" lowercases to "i̇" (two code units); the highlight must not drift.
  const source = "İSTANBUL clause. The Secretary shall\nact now.";
  const result = findQuote(source, "the secretary shall act now");
  assert.equal(result.found, true);
  assert.equal(result.match, "The Secretary shall\nact now");
});
