import assert from "node:assert/strict";
import test from "node:test";

import type { BallotResponse } from "./ballot-lookup";
import {
  ballotContestRoute,
  ballotElectionDate,
  ballotElectionOptions,
  ballotModel,
  ballotOfficeUrl,
  contestBallotCitations,
  currentBallot,
  isBallotMeasure,
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
});

void test("election calendar dates retain the provider day", () => {
  assert.equal(ballotElectionDate("2099-11-03"), "November 3, 2099");
  assert.equal(ballotElectionDate("not-a-date"), "not-a-date");
});

void test("provider lookup URL and empty normalized address do not imply official office or California", () => {
  const data: BallotResponse = {
    kind: "provider",
    normalizedInput: { state: "" },
    provider: {
      name: "democracy_works",
      fetchedAt: "2099-10-01T12:00:00Z",
      coverage: "partial",
      addressScope: "statewide_only",
      ballotDataStatus: "provided",
      addressNormalization: "unavailable",
      logistics: "lookup_links_only",
    },
    state: [
      {
        name: "California",
        electionAdministrationBody: {
          electionInfoUrl: "https://example.org/lookup",
        },
      },
    ],
  };
  assert.equal(ballotOfficeUrl(data), undefined);
  assert.equal(ballotModel(data).isCalifornia, false);
});

void test("cached ballot details are hidden during edits, refreshes, failures and mismatched elections", () => {
  const data = response("CA");
  const ready = { data, editing: false, fetching: false, failed: false };
  assert.equal(currentBallot(ready).data, data);
  for (const state of [
    { editing: true },
    { fetching: true },
    { failed: true },
    { requestedElectionId: "another-election" },
  ])
    assert.equal(currentBallot({ ...ready, ...state }).data, undefined);
  assert.equal(
    currentBallot({ ...ready, requestedElectionId: "another-election" })
      .mismatch,
    true,
  );
  assert.equal(
    currentBallot({ ...ready, requestedElectionId: data.election?.id }).data,
    data,
  );
});

void test("candidate navigation retains provider contact, withdrawal status and citations", () => {
  const candidates = [
    {
      name: "Example candidate",
      candidateUrl: "https://example.org/campaign",
      ballotStatus: "withdrewStillOnBallot" as const,
      statement: "Original statement",
      citations: [
        {
          field: "statement",
          sourceName: "Election office",
          tier: "state_sos",
          official: true,
        },
      ],
    },
  ];
  const route = ballotContestRoute({
    type: "candidate",
    office: "Mayor",
    candidates,
    sources: [
      { name: "Provider", official: false, url: "https://example.org/ballot" },
    ],
  });
  assert.equal(route.pathname, "/contest-detail");
  assert.deepEqual(JSON.parse(route.params.candidates), candidates);
  assert.equal((JSON.parse(route.params.citations) as unknown[]).length, 1);
});

void test("measure navigation preserves summaries, original text, and source attribution", () => {
  const route = ballotContestRoute({
    type: "referendum",
    referendumTitle: "Measure A",
    summaryShort: "Short overview",
    summary: "Provider overview",
    summaryLong: "Extended overview",
    referendumText: "Original ballot question",
    summaryIsAiGenerated: true,
    sources: [
      { name: "Provider", official: false, url: "https://example.org/ballot" },
    ],
    citations: [
      {
        field: "summaryShort",
        sourceName: "Generated",
        official: false,
        tier: "ai_generated",
      },
    ],
  });
  assert.equal(route.pathname, "/measure-detail");
  assert.equal(route.params.summaryShort, "Short overview");
  assert.equal(route.params.summaryLong, "Extended overview");
  assert.equal(route.params.summary, "Provider overview");
  assert.equal(route.params.referendumText, "Original ballot question");
  assert.equal(route.params.summaryIsAiGenerated, "true");
  assert.equal((JSON.parse(route.params.citations) as unknown[]).length, 2);
});

void test("a measure without a title still opens the measure reader", () => {
  const contest = { type: "Referendum", referendumText: "Supplied question" };
  assert.equal(isBallotMeasure(contest), true);
  const route = ballotContestRoute(contest);
  assert.equal(route.pathname, "/measure-detail");
  assert.equal(route.params.referendumTitle, "Ballot measure");
  assert.equal(isBallotMeasure({ type: "candidate", office: "Mayor" }), false);
});

void test("candidate navigation carries vetted election context", () => {
  const route = ballotContestRoute(
    {
      type: "candidate",
      office: "Secretary of State",
      district: { name: "California", id: "ocd-division/country:us/state:ca" },
    },
    { state: "CA", electionDate: "2026-11-03" },
  );
  assert.equal(route.pathname, "/contest-detail");
  assert.equal(route.params.state, "CA");
  assert.equal(route.params.electionDate, "2026-11-03");
  assert.equal(route.params.districtId, "ocd-division/country:us/state:ca");
});
