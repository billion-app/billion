import assert from "node:assert/strict";
import test from "node:test";

import { candidateStatementExcerpt } from "./candidate-statement";

void test("short statements need no misleading expansion", () => {
  assert.deepEqual(
    candidateStatementExcerpt("  A short candidate statement.  "),
    { text: "A short candidate statement.", truncated: false },
  );
});
void test("long statement excerpt preserves original whitespace and word boundaries", () => {
  const statement = Array.from(
    { length: 40 },
    (_, index) => `word${index}`,
  ).join(" \n ");
  const excerpt = candidateStatementExcerpt(statement);
  assert.equal(excerpt.truncated, true);
  assert.ok(statement.startsWith(excerpt.text));
  assert.ok(excerpt.text.endsWith("word29"));
  assert.ok(!excerpt.text.includes("word30"));
});
