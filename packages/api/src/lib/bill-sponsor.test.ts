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

void test("parses a state-legislator district without treating it as a state", () => {
  assert.deepEqual(parseBillSponsor("Steve Padilla (D-18)", "ca"), {
    raw: "Steve Padilla (D-18)",
    name: "Steve Padilla",
    initials: "SP",
    partyCode: "D",
    party: "Democratic",
    state: undefined,
    district: "18",
  });
  assert.equal(sponsorRole("Senate", "ca"), "California State Senator");
  assert.equal(sponsorRole("Assembly", "ca"), "California Assemblymember");
  assert.equal(sponsorRole("Senate", "mo"), "Missouri State Senator");
  assert.equal(
    sponsorRole("House", "nc"),
    "North Carolina State Representative",
  );
  assert.equal(sponsorRole("House", "tx"), "Texas State Representative");
});
