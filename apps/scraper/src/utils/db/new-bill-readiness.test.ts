import assert from "node:assert/strict";
import test from "node:test";

import { newBillReadiness } from "./operations.js";

/**
 * These assertions describe what a reader would see if the rule were loosened.
 * A bill that fails any of them renders as a grey "bill · header art"
 * placeholder above a wall of raw GPO text — which is the state that prompted
 * this path to exist, not a hypothetical.
 */

// Long enough and prose-like enough to pass `isUsableSourceText`.
const usableText = `A BILL To amend title 18 of the United States Code to do
a specific thing that is described here at sufficient length to read as real
legislative prose rather than boilerplate. It contains several sentences so the
usability heuristic does not reject it as a header-only fragment. ${"Additional substantive text. ".repeat(
  8,
)}`;

const complete = {
  description: "This bill would require hospitals to publish their prices.",
  fullText: usableText,
  hasBrief: true,
  headerArt: { imageData: Buffer.from("jpeg"), thumbnailUrl: null },
};

test("a bill with description, text, brief and art is ready", () => {
  assert.deepEqual(newBillReadiness(complete), { ready: true });
});

test("a scraped thumbnail counts as header art", () => {
  // Either one renders; only the absence of both shows the placeholder.
  const result = newBillReadiness({
    ...complete,
    headerArt: { imageData: null, thumbnailUrl: "https://example.gov/i.jpg" },
  });
  assert.equal(result.ready, true);
});

test("art generation producing neither image nor thumbnail blocks the bill", () => {
  const result = newBillReadiness({
    ...complete,
    headerArt: { imageData: null, thumbnailUrl: null },
  });
  assert.equal(result.ready, false);
  assert.match(result.reason!, /header art/);
});

test("art generation failing outright blocks the bill", () => {
  const result = newBillReadiness({ ...complete, headerArt: null });
  assert.equal(result.ready, false);
  assert.match(result.reason!, /header art/);
});

test("a missing brief blocks the bill", () => {
  // Without a brief the detail screen falls back to the legacy article, which
  // bills no longer generate — so the reader gets raw GPO text.
  const result = newBillReadiness({ ...complete, hasBrief: false });
  assert.equal(result.ready, false);
  assert.match(result.reason!, /brief/);
});

test("a blank or whitespace description blocks the bill", () => {
  for (const description of [undefined, null, "", "   "]) {
    const result = newBillReadiness({ ...complete, description });
    assert.equal(result.ready, false, `description ${JSON.stringify(description)}`);
    assert.match(result.reason!, /description/);
  }
});

test("unusable source text blocks the bill", () => {
  for (const fullText of [undefined, null, "", "SHORT"]) {
    const result = newBillReadiness({ ...complete, fullText });
    assert.equal(result.ready, false, `fullText ${JSON.stringify(fullText)}`);
    assert.match(result.reason!, /text/);
  }
});
