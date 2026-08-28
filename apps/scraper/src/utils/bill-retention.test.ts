import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeBillRetentionPolicy,
  normalizeRetentionJurisdiction,
} from "./bill-retention.js";

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

void test("retention policy requires positive whole-number bounds", () => {
  assert.deepEqual(
    normalizeBillRetentionPolicy({ activeDays: 90, topPerCategory: 50 }),
    { activeDays: 90, topPerCategory: 50 },
  );
  for (const policy of [
    { activeDays: 0, topPerCategory: 50 },
    { activeDays: 90.5, topPerCategory: 50 },
    { activeDays: 90, topPerCategory: -1 },
  ]) {
    assert.throws(
      () => normalizeBillRetentionPolicy(policy),
      /positive integer/,
    );
  }
});
