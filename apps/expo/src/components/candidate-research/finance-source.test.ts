import assert from "node:assert/strict";
import { test } from "node:test";

import { financeFilingSource, financeResearchSource } from "./finance-source";

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

test("missing financial totals can link to the collected official filing portal", () => {
  const source = {
    origin: "primary_record" as const,
    title: "Search California campaign filings",
    publisher: "California Secretary of State",
    url: "https://powersearch.sos.ca.gov/",
  };
  assert.deepEqual(financeFilingSource([source]), {
    label: source.title,
    url: source.url,
  });
  assert.equal(
    financeFilingSource([{ ...source, origin: "candidate" }]),
    undefined,
  );
  assert.equal(
    financeFilingSource([
      { ...source, url: "https://powersearch.sos.ca.gov.example.org/" },
    ]),
    undefined,
  );
  assert.equal(financeFilingSource([]), undefined);
});
