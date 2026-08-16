import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRetentionJurisdiction } from "./bill-retention.js";

void test("retention jurisdictions are normalized", () => {
  assert.equal(normalizeRetentionJurisdiction("us"), "US");
  assert.equal(normalizeRetentionJurisdiction(" ca "), "CA");
});

void test("retention rejects malformed jurisdictions", () => {
  for (const jurisdiction of ["", "USA", "C", "C1", "STATE"]) {
    assert.throws(
      () => normalizeRetentionJurisdiction(jurisdiction),
      /Invalid bill-retention jurisdiction/,
    );
  }
});
