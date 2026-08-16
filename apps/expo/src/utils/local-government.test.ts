import assert from "node:assert/strict";
import test from "node:test";

import { coverageSummary, coveredJurisdiction } from "./local-government";

void test("recognises each covered jurisdiction from a stored address", () => {
  assert.equal(
    coveredJurisdiction("200 E Santa Clara St, San Jose, CA, USA")?.id,
    "sanjose",
  );
  assert.equal(
    coveredJurisdiction("70 W Hedding St, Santa Clara County, CA")?.id,
    "santaclara",
  );
  assert.equal(
    coveredJurisdiction("456 W Olive Ave, Sunnyvale, CA 94086")?.id,
    "sunnyvale",
  );
});

void test("matches San José with its accent", () => {
  assert.equal(
    coveredJurisdiction("1 N Market St, San José, CA")?.id,
    "sanjose",
  );
});

void test("returns nothing outside coverage — the common, non-error case", () => {
  // A Sacramento reader must never be told San Jose is "your" local government.
  assert.equal(coveredJurisdiction("1414 K Street, Sacramento, CA"), undefined);
  assert.equal(coveredJurisdiction(null), undefined);
  assert.equal(coveredJurisdiction(""), undefined);
});

void test("coverage summary reads as a scope, not an apology", () => {
  assert.equal(
    coverageSummary(),
    "San Jose, Santa Clara County, and Sunnyvale",
  );
});
