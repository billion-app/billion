import assert from "node:assert/strict";
import test from "node:test";

import { candidateStatementExcerpt } from "./candidate-statement";

void test("short statements remain complete without an artificial reading gate", () => {
  const statement = "  I propose evening library hours.\nA second paragraph.  ";
  assert.deepEqual(candidateStatementExcerpt(statement), {
    text: statement,
    truncated: false,
  });
});
void test("long excerpts end at a verbatim sentence when available", () => {
  const statement =
    "I propose evening library hours. " + "More detail ".repeat(50);
  const excerpt = candidateStatementExcerpt(statement, 100);
  assert.equal(excerpt.text, "I propose evening library hours.");
  assert.equal(excerpt.truncated, true);
  assert.ok(statement.startsWith(excerpt.text));
});
void test("a long single sentence is cut between words rather than mid-word", () => {
  const excerpt = candidateStatementExcerpt(
    "A proposal for neighborhood libraries and better services",
    25,
  );
  assert.equal(excerpt.text, "A proposal for…");
});
