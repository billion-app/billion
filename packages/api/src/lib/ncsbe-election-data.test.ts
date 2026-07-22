import assert from "node:assert/strict";
import test from "node:test";

import { matchNcsbeName } from "./ncsbe-election-data";

void test("matches NCSBE contests exactly after party suffix normalization", () => {
  assert.deepEqual(
    matchNcsbeName("US SENATE (DEM)", ["US Senate", "NC Senate District 20"]),
    { value: "US Senate", method: "exact", score: 1 },
  );
});

void test("uses an unambiguous token fallback for Civic wording differences", () => {
  assert.deepEqual(
    matchNcsbeName("NC COURT APPEALS JUDGE SEAT 01", [
      "North Carolina Court of Appeals Judge Seat 01",
      "North Carolina Supreme Court Associate Justice",
    ]),
    {
      value: "North Carolina Court of Appeals Judge Seat 01",
      method: "token",
      score: 14 / 15,
    },
  );
});

void test("rejects ambiguous or weak fuzzy matches", () => {
  assert.equal(
    matchNcsbeName("County Board", [
      "County Board Seat 1",
      "County Board Seat 2",
    ]),
    null,
  );
  assert.equal(matchNcsbeName("Mayor", ["US Senate"]), null);
});
