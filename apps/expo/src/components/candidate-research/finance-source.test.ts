import assert from "node:assert/strict";
import { test } from "node:test";

import { financeResearchSource } from "./finance-source";

test("federal offices use FEC resources regardless of state", () => {
  for (const office of [
    "U.S. House of Representatives",
    "United States Senator",
    "President",
    "Member of Congress",
  ]) {
    assert.equal(
      financeResearchSource("CA", office).url,
      "https://www.fec.gov/data/",
    );
  }
});
test("local presidents and state senators never route to federal finance data", () => {
  for (const office of [
    "School Board President",
    "State Senator",
    "Governor",
    "School Board",
  ]) {
    assert.equal(
      financeResearchSource("CA", office).url,
      "https://www.fppc.ca.gov/search-filings/",
    );
  }
});
test("unknown jurisdictions use the election-office resource", () => {
  assert.equal(
    financeResearchSource(undefined, undefined).url,
    "https://www.usa.gov/state-election-office",
  );
});
