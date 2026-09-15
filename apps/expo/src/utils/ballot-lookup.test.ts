import assert from "node:assert/strict";
import test from "node:test";

import type { BallotResponse } from "./ballot-lookup";
import {
  ballotElectionOptions,
  ballotModel,
  ballotWebUrl,
  contestBallotCitations,
  validateBallotAddress,
} from "./ballot-lookup";

function response(state: string): BallotResponse {
  return {
    kind: "civic#voterInfoResponse",
    normalizedInput: {
      line1: "1 Main Street",
      city: "Example",
      state,
      zip: "00000",
    },
    election: {
      id: "address-specific",
      name: "Example election",
      electionDay: "2026-11-03",
      ocdDivisionId: "ocd-division/country:us",
    },
    contests: [
      {
        type: "General",
        office: "Town council",
        candidates: [{ name: "Example candidate" }],
      },
    ],
  };
}

void test("CA and non-CA retain base contests without enrichment", () => {
  for (const state of ["CA", "California", "NC", "TX", "NY"]) {
    const data = response(state);
    const model = ballotModel(data);
    assert.equal(model.contests, data.contests);
    assert.equal(model.election?.id, "address-specific");
    assert.equal(model.isCalifornia, ["CA", "California"].includes(state));
  }
});
void test("partial contests are retained and empty ballots do not imply publication", () => {
  const data = response("");
  data.contests = [{ type: "General", office: "Unknown candidates" }];
  assert.equal(ballotModel(data).contests.length, 1);
  delete data.contests;
  assert.equal(ballotModel(data).empty, true);
  assert.equal(ballotModel(data).isCalifornia, false);
});
void test("selection keeps discovered alternatives even if subsequent response omits them", () => {
  const discovery = response("NC");
  assert.ok(discovery.election);
  const alternative = {
    ...discovery.election,
    id: "second",
    name: "Special election",
  };
  discovery.otherElections = [alternative, discovery.election];
  const selected = { ...response("NC"), election: alternative };
  assert.deepEqual(
    ballotElectionOptions(discovery, selected).map((e) => e.id),
    ["address-specific", "second"],
  );
  assert.deepEqual(ballotElectionOptions(undefined), []);
});
void test("official links reject executable and malformed URLs", () => {
  assert.equal(ballotWebUrl("javascript:alert(1)"), undefined);
  assert.equal(ballotWebUrl("not a url"), undefined);
  assert.equal(
    ballotWebUrl("https://elections.example.gov/results"),
    "https://elections.example.gov/results",
  );
});

void test("missing election and normalized address remain unknown", () => {
  const data: BallotResponse = { kind: "civic#voterInfoResponse" };
  assert.equal(ballotModel(data).election, undefined);
  assert.equal(ballotModel(data).isCalifornia, false);
  assert.deepEqual(ballotElectionOptions(data), []);
});

void test("address validation bounds input without claiming eligibility", () => {
  for (const value of ["", "   ", "abcd", "x".repeat(301), "123\nMain"])
    assert.equal(validateBallotAddress(value), false);
  for (const value of ["123 Main St, Example, NC", "x".repeat(300)])
    assert.equal(validateBallotAddress(value), true);
});
void test("contest citations preserve field and official evidence without inferring it from URLs", () => {
  const citation = {
    field: "referendumText",
    sourceName: "Office",
    sourceUrl: "https://example.org/source",
    official: true,
    tier: "state_sos",
  };
  const result = contestBallotCitations({
    type: "Referendum",
    citations: [citation],
    sources: [{ name: "Office", url: citation.sourceUrl, official: true }],
    referendumUrl: "https://example.org/measure",
  });
  assert.deepEqual(result[0], citation);
  assert.equal(result.length, 2);
  assert.equal(result[1]?.official, false);
  assert.equal(ballotWebUrl("https://user:password@example.org"), undefined);
});
