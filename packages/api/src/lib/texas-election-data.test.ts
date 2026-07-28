import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  parseTexasSosDiscovery,
  parseTexasSosElection,
  parseTexasTlcAnalysis,
  TEXAS_SOS_PROVIDER,
  TEXAS_TLC_PROVIDER,
} from "./texas-election-data";

function fixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8"),
  ) as T;
}

void test("SOS discovery selects the current cycle without hard-coded year URLs", () => {
  const discovery = parseTexasSosDiscovery(fixture("texas-sos-constants.json"));
  assert.equal(discovery.cycleYear, 2026);
  assert.deepEqual(
    discovery.elections.map((election) => election.id),
    [53813, 53815],
  );
  assert.equal(discovery.electionsByYear[2025]?.[0]?.id, 51031);
});

void test("SOS parser normalizes current candidate contests and official status", () => {
  const discovery = parseTexasSosDiscovery(fixture("texas-sos-constants.json"));
  const definition = discovery.elections.find(
    (election) => election.id === 53813,
  );
  assert.ok(definition);
  const election = parseTexasSosElection(
    fixture("texas-sos-election.json"),
    definition,
    undefined,
    new Date("2026-07-21T00:00:00Z"),
  );
  assert.equal(election.status, "official");
  assert.equal(election.reporting.percentReporting, 100);
  const contest = election.contests[0];
  assert.ok(contest);
  const choice = contest.choices[0];
  assert.ok(choice);
  assert.equal(contest.title, "GOVERNOR");
  assert.equal(choice.name, "GREG ABBOTT");
  assert.equal(choice.incumbent, true);
  assert.equal(contest.citation.provider, TEXAS_SOS_PROVIDER);
});

void test("SOS amendment results include outcome, county totals, and turnout", () => {
  const discovery = parseTexasSosDiscovery(fixture("texas-sos-constants.json"));
  const definition = discovery.electionsByYear[2025]?.[0];
  assert.ok(definition);
  const election = parseTexasSosElection(
    fixture("texas-sos-amendment.json"),
    definition,
    fixture("texas-sos-county.json"),
    new Date("2026-07-21T00:00:00Z"),
  );
  const contest = election.contests[0];
  assert.ok(contest);
  assert.equal(election.status, "complete");
  assert.equal(contest.type, "referendum");
  assert.equal(contest.propositionNumber, 1);
  assert.equal(contest.outcome, "adopted");
  const county = contest.counties[0];
  assert.ok(county);
  const countyChoice = county.choices[0];
  assert.ok(countyChoice);
  assert.equal(county.county, "ANDERSON");
  assert.equal(countyChoice.votes, 3361);
  assert.ok(election.turnout);
  assert.equal(election.turnout.registeredVoters, 80544);
  assert.equal(election.turnout.ballotsCast, 4739);
});

void test("TLC 2025 layout preserves page citations and separate explanation tier", () => {
  const parsed = parseTexasTlcAnalysis(
    fixture("texas-tlc-2025.json"),
    "https://tlc.texas.gov/docs/amendments/analyses25.pdf",
  );
  assert.equal(parsed.cycleYear, 2025);
  assert.equal(parsed.electionDate, "NOVEMBER 4, 2025");
  assert.equal(parsed.measures.length, 2);
  const first = parsed.measures[0];
  assert.ok(first);
  assert.equal(first.resolution, "SJR 59");
  assert.match(first.ballotLanguage ?? "", /permanent technical institution/i);
  assert.equal(first.supporterArguments.length, 2);
  assert.equal(first.opponentArguments.length, 1);
  assert.match(first.fiscalImplications[0] ?? "", /\$850 million/);
  const summaryCitation = first.citations.summaryAnalysis;
  assert.ok(summaryCitation);
  assert.equal(summaryCitation.provider, TEXAS_TLC_PROVIDER);
  assert.equal(summaryCitation.page, 10);
  assert.match(summaryCitation.sourceUrl, /#page=10$/);
});

void test("TLC 2023 alternate layout fails soft when a section is absent", () => {
  const parsed = parseTexasTlcAnalysis(
    fixture("texas-tlc-2023.json"),
    "https://tlc.texas.gov/docs/amendments/analyses23.pdf",
  );
  const measure = parsed.measures[0];
  assert.ok(measure);
  assert.equal(measure.propositionNumber, 1);
  assert.match(measure.background ?? "", /Existing statutes/);
  assert.deepEqual(measure.opponentArguments, []);
  assert.ok(measure.diagnostics.includes("missing opponent comments"));
});
