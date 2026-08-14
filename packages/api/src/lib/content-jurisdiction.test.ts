import assert from "node:assert/strict";
import test from "node:test";

import {
  billJurisdiction,
  officialSourceLabel,
  parseStateBillNumber,
} from "./content-jurisdiction";

void test("parses an Open States bill identity", () => {
  assert.deepEqual(parseStateBillNumber("CA SB 243 (2025-2026)"), {
    stateCode: "CA",
    identifier: "SB 243",
    sessionLabel: "2025-2026",
  });
});

void test("distinguishes California and federal bills", () => {
  assert.equal(
    billJurisdiction("openstates.org", "CA SB 243 (2025-2026)"),
    "ca",
  );
  assert.equal(billJurisdiction("congress.gov", "S. 243"), "federal");
});

void test("uses a jurisdiction-correct official source label", () => {
  assert.equal(officialSourceLabel("ca"), "California Legislature");
  assert.equal(officialSourceLabel("federal"), "congress.gov");
});
