import assert from "node:assert/strict";
import { test } from "node:test";

import {
  exampleForMeasure,
  exampleForOffice,
  governanceMaps,
} from "./governance-map";

test("governance examples require unambiguous California and election context", () => {
  assert.equal(exampleForOffice("Governor", "state", "California"), "governor");
  assert.equal(exampleForOffice("Governor", "", ""), null);
  assert.equal(exampleForOffice("Governor", "state", "Texas"), null);
  assert.equal(
    exampleForMeasure("4", "2026-11-03", "California"),
    "prop-4-2026",
  );
  assert.equal(exampleForMeasure("4", "2024-11-05", "California"), null);
  assert.equal(exampleForMeasure("4", "2026-06-02", "California"), null);
  assert.equal(exampleForMeasure("4", "2026-11-03", "Texas"), null);
});

test("every relationship has a matching official source", () => {
  for (const map of Object.values(governanceMaps)) {
    const sourceIds = new Set(map.sources.map((source) => source.id));
    assert.ok(map.nodes.every((node) => sourceIds.has(node.source)));
    assert.ok(map.nodes.every((node) => node.detail.length > 0));
  }
});
