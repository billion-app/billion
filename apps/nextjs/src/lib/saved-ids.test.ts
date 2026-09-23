import assert from "node:assert/strict";
import test from "node:test";

import { isLoadableId, splitSaved } from "./saved-ids";

const REAL = "2d5593a6-2c02-4297-ba8c-f42048910193";
const GONE = "11111111-1111-4111-8111-111111111111";

void test("ids are checked exactly as content.byIds checks them", () => {
  assert.equal(isLoadableId(REAL), true);
  assert.equal(isLoadableId("not-a-uuid"), false);
  // Right shape, but no RFC version digit: the server's z.uuid() rejects it,
  // and one such id would fail the whole request.
  assert.equal(isLoadableId("12345678-1234-1234-1234-123456789012"), false);
});

void test("malformed ids are separated before the request", () => {
  const split = splitSaved([REAL, "bad", GONE], null);
  assert.deepEqual(split.loadable, [REAL, GONE]);
  assert.deepEqual(split.malformed, ["bad"]);
  assert.deepEqual(split.missing, []);
});

void test("ids the server did not return are reported, not decided", () => {
  const split = splitSaved([REAL, GONE], new Set([REAL]));
  assert.deepEqual(split.missing, [GONE]);
});
