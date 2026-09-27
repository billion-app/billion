import assert from "node:assert/strict";
import test from "node:test";

import { courtSourceQuote, findSourcePassage } from "./source-passage";

void test("court quote navigation preserves its source document", () => {
  assert.deepEqual(
    courtSourceQuote({
      text: "The application is denied.",
      documentId: "document-2",
      locator: null,
    }),
    {
      text: "The application is denied.",
      documentId: "document-2",
      locator: undefined,
    },
  );
});

void test("a court quote is found only inside its attributed document", () => {
  const repeated = "The application is denied.";
  const content = [
    "Source: https://example.org/order.pdf",
    repeated,
    "Source: https://example.org/dissent.pdf",
    `Justice A wrote: ${repeated}`,
  ].join("\n");

  const passage = findSourcePassage(content, repeated, "document-2");
  assert.equal(passage.found, true);
  assert.equal(passage.before.length, content.lastIndexOf(repeated));
  assert.match(passage.before, /dissent\.pdf\nJustice A wrote: $/);
  assert.equal(passage.match, repeated);
});

void test("bill quotes and single-document courts still search the full text", () => {
  const content = "Section 1. The agency shall act. Section 2.";
  assert.equal(
    findSourcePassage(content, "The agency shall act.").match,
    "The agency shall act.",
  );
  assert.equal(
    findSourcePassage(content, "The agency shall act.", "document-1").match,
    "The agency shall act.",
  );
});

void test("an unknown document never falls back to a different source", () => {
  const content = "Source: https://example.org/one.pdf\nRepeated wording.";
  assert.deepEqual(
    findSourcePassage(content, "Repeated wording.", "document-2"),
    {
      found: false,
      before: "",
      match: "Repeated wording.",
      after: content,
    },
  );
});
