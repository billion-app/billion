import assert from "node:assert/strict";
import test from "node:test";

import { parseBillSponsor, sponsorRole } from "./bill-sponsor";

void test("parses scraper sponsor labels", () => {
  assert.deepEqual(parseBillSponsor("John Smith (D-CA)"), {
    raw: "John Smith (D-CA)",
    name: "John Smith",
    initials: "JS",
    partyCode: "D",
    party: "Democratic",
    state: "CA",
    district: undefined,
  });
});

void test("parses seeded labels with titles and districts", () => {
  assert.deepEqual(parseBillSponsor("Rep. Maria Torres (R-TX-12)"), {
    raw: "Rep. Maria Torres (R-TX-12)",
    name: "Maria Torres",
    initials: "MT",
    partyCode: "R",
    party: "Republican",
    state: "TX",
    district: "12",
  });
});

void test("keeps a useful name when metadata is unavailable", () => {
  assert.deepEqual(parseBillSponsor("Sen. Jane Doe"), {
    raw: "Sen. Jane Doe",
    name: "Jane Doe",
    initials: "JD",
    partyCode: undefined,
    party: undefined,
    state: undefined,
    district: undefined,
  });
});

void test("maps bill chamber to the sponsor's role", () => {
  assert.equal(sponsorRole("Senate"), "U.S. Senator");
  assert.equal(sponsorRole("House"), "U.S. Representative");
});
