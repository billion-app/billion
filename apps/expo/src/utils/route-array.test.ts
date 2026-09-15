import assert from "node:assert/strict";
import { test } from "node:test";

import { parseRouteArray } from "./route-array";

void test("detail routes reject malformed arrays and unsafe field types", () => {
  for (const raw of [
    undefined,
    "{",
    "null",
    "{}",
    "42",
    '[null,[],{"name":3}]',
  ])
    assert.deepEqual(parseRouteArray(raw, ["name"]), []);
  assert.deepEqual(
    parseRouteArray(
      '[{"name":"Alex","phone":{}},{"name":"Jordan","phone":"555"}]',
      ["name"],
      ["phone"],
    ),
    [{ name: "Jordan", phone: "555" }],
  );
});
void test("malformed citation metadata cannot become a React child", () => {
  assert.deepEqual(
    parseRouteArray(
      '[{"field":"summary","sourceName":"Source","fetchedAt":{}}]',
      ["field", "sourceName"],
      ["sourceUrl", "tier", "fetchedAt", "verifiedAt", "verifiedBy"],
    ),
    [],
  );
});
