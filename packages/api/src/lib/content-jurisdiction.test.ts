import assert from "node:assert/strict";
import test from "node:test";

import {
  billJurisdiction,
  displaySessionLabel,
  jurisdictionCode,
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

void test("distinguishes supported state and federal bills", () => {
  assert.equal(
    billJurisdiction("openstates.org", "CA SB 243 (2025-2026)"),
    "ca",
  );
  assert.equal(billJurisdiction("openstates.org", "MO SB 1320 (2026)"), "mo");
  assert.equal(billJurisdiction("openstates.org", "NC SB 445 (2025)"), "nc");
  assert.equal(billJurisdiction("openstates.org", "TX SB 1 (892)"), "tx");
  assert.equal(billJurisdiction("congress.gov", "S. 243"), "federal");
});

void test("uses a jurisdiction-correct official source label", () => {
  assert.equal(officialSourceLabel("ca"), "California Legislature");
  assert.equal(officialSourceLabel("mo"), "Missouri General Assembly");
  assert.equal(officialSourceLabel("nc"), "North Carolina General Assembly");
  assert.equal(officialSourceLabel("tx"), "Texas Legislature");
  assert.equal(officialSourceLabel("federal"), "congress.gov");
});

void test("provides codes and friendly current-session labels", () => {
  assert.equal(jurisdictionCode("mo"), "MO");
  assert.equal(jurisdictionCode("nc"), "NC");
  assert.equal(jurisdictionCode("tx"), "TX");
  assert.equal(
    displaySessionLabel("tx", "892"),
    "89th Legislature · 2nd called session",
  );
  assert.equal(displaySessionLabel("tx", "881"), "881");
});
