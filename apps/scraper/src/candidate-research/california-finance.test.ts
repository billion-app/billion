import assert from "node:assert/strict";
import test from "node:test";

import type { CaliforniaRaceTarget, ResearchSource } from "@acme/validators";

import type { CaliforniaFinanceDependencies } from "./california-finance.js";
import {
  collectCaliforniaFederalFinance,
  resolveCaliforniaFecCandidate,
} from "./california-finance.js";
import { hash } from "./sources.js";

const candidate = {
  candidate_id: "H6CA01269",
  name: "MCGUIRE, MIKE",
  office: "H",
  state: "CA",
  district: "01",
  cycles: [2026],
  election_years: [2026],
};
const identity = {
  candidateId: "ca-sos:2026-11-03:110000010000:3791",
  contestId: "ca-sos:2026-11-03:110000010000",
  jurisdiction: "ocd-division/country:us/state:ca/cd:1",
  electionDate: "2026-11-03",
};
const member: CaliforniaRaceTarget["members"][number] = {
  identity,
  candidateId: identity.candidateId,
  name: "Mike McGuire",
  sourceCandidateId: "3791",
  partyCode: "01",
  party: "Democratic",
  ballotStatus: "on_ballot",
};
const race: CaliforniaRaceTarget = {
  raceKey: "ca-sos-2026-11-03-110000010000",
  contestId: identity.contestId,
  jurisdiction: identity.jurisdiction,
  jurisdictionLabel: "California · District 1",
  electionDate: identity.electionDate,
  sourceContestId: "110000010000",
  officeFamily: "us_house",
  office: "United States Representative District 1",
  district: "1",
  kind: "election",
  rosterDigest: "a".repeat(64),
  members: [member],
};
const now = "2026-10-30T12:00:00.000Z";
function source(
  id: string,
  url: string,
  format: ResearchSource["format"],
  value: unknown,
): ResearchSource {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return {
    id,
    url,
    format,
    text,
    contentHash: hash(text),
    publisher: "Synthetic FEC fixture",
    fetchedAt: now,
  };
}
function fixture() {
  const calls: string[] = [];
  const deps: CaliforniaFinanceDependencies = {
    sharedSources: new Map(),
    budget: { request() {} },
    fetch: async (_id, url) => {
      calls.push(url);
      throw new Error("No fixture source");
    },
  };
  return { deps, calls };
}
test("full-name matching never selects another district, office, state, election or ambiguous ID", () => {
  const input = {
    candidates: [candidate],
    name: member.name,
    district: "1",
    cycle: 2026,
  };
  assert.equal(
    resolveCaliforniaFecCandidate(input)?.candidate_id,
    candidate.candidate_id,
  );
  for (const changed of [
    { district: "17" },
    { office: "S" },
    { state: "NV" },
    { cycles: [2024] },
    { election_years: [2024] },
    { name: "MCGUIRE, MICHAEL" },
  ])
    assert.equal(
      resolveCaliforniaFecCandidate({
        ...input,
        candidates: [{ ...candidate, ...changed }],
      }),
      null,
    );
  assert.equal(
    resolveCaliforniaFecCandidate({
      ...input,
      candidates: [candidate, { ...candidate, candidate_id: "H6CA01277" }],
    }),
    null,
  );
  assert.equal(
    resolveCaliforniaFecCandidate({ ...input, name: "Mike J. McGuire" }),
    null,
  );
});
test("state and local candidates never issue federal finance requests", async () => {
  const f = fixture();
  const result = await collectCaliforniaFederalFinance(
    { race: { ...race, officeFamily: "state_assembly" }, member },
    f.deps,
  );
  assert.equal(f.calls.length, 0);
  assert.equal(result.finance, null);
  assert.match(result.gap ?? "", /do not apply/);
  const otherState = await collectCaliforniaFederalFinance(
    {
      race: { ...race, jurisdiction: "ocd-division/country:us/state:nv/cd:1" },
      member,
    },
    f.deps,
  );
  assert.equal(otherState.finance, null);
  assert.equal(f.calls.length, 0);
});
test("a run budget exception escapes instead of being mislabeled as unavailable finance", async () => {
  class CaliforniaBudgetReached extends Error {}
  const f = fixture();
  f.deps.budget.request = () => {
    throw new CaliforniaBudgetReached("source requests");
  };
  await assert.rejects(
    collectCaliforniaFederalFinance({ race, member }, f.deps),
    CaliforniaBudgetReached,
  );
});
test("official master resolution preserves incomplete upstream rows without guessing a target identity", async () => {
  const { resolveFecIdentityFromSource } = await import("@acme/validators");
  const text =
    [
      "H6CA01269|MCGUIRE, MIKE|DEM|2026|CA|H|01|C|C|C00926519|||||",
      "H0MO07113|LONG, BILLY MR.|REP|2022|MO|S|00|C|C||||||",
      "H6AZ08210|||2026|AZ|H||C|C||||||",
    ].join("\n") + "\n";
  const input = source(
    "master",
    "https://www.fec.gov/files/bulk-downloads/2026/cn26.zip",
    "text",
    text,
  );
  const query = { name: "Mike McGuire", district: "1", cycle: 2026 };
  assert.equal(
    resolveFecIdentityFromSource(input, query)?.candidateId,
    candidate.candidate_id,
  );
  for (const change of [
    { name: "Mike" },
    { name: "Michael McGuire" },
    { district: "17" },
    { cycle: 2024 },
  ]) {
    const changedQuery = { ...query, ...change };
    if (changedQuery.cycle !== 2026)
      assert.throws(() => resolveFecIdentityFromSource(input, changedQuery));
    else assert.equal(resolveFecIdentityFromSource(input, changedQuery), null);
  }
  for (const changed of [
    text.replace("2026|CA", "2024|CA"),
    text.replace("2026|CA|H|01", "2026|NV|H|01"),
    text.replace("2026|CA|H|01", "2026|CA|S|01"),
    text.replace("MCGUIRE, MIKE", ""),
    text.replace("2026|CA|H|01", "2026|CA|H|"),
    text + text.split("\n")[0]!.replace("H6CA01269", "H6CA01277") + "\n",
  ])
    assert.equal(
      resolveFecIdentityFromSource({ ...input, text: changed }, query),
      null,
    );
  for (const changed of [
    text + text,
    text.replace("H6CA01269", "not-an-id"),
    text.replace("|DEM|", "|DEM|extra|"),
    text + "\ninvalid\n",
  ]) {
    assert.throws(() =>
      resolveFecIdentityFromSource({ ...input, text: changed }, query),
    );
  }
  for (const url of [
    "https://fec.gov.evil.example/files/bulk-downloads/2026/cn26.zip",
    "http://www.fec.gov/files/bulk-downloads/2026/cn26.zip",
    "https://www.fec.gov/files/bulk-downloads/2026/cn24.zip",
    input.url + "?download=1",
    input.url + "#fragment",
  ])
    assert.throws(() => resolveFecIdentityFromSource({ ...input, url }, query));
});

test("typed transient source failures escape without publishing partial finance", async () => {
  const { CaliforniaSourceHttpError, CaliforniaSourceUnavailable } =
    await import("./california-source-availability.js");
  for (const error of [
    new CaliforniaSourceHttpError(429),
    new CaliforniaSourceHttpError(503),
    Object.assign(new Error("connection reset"), { code: "ECONNRESET" }),
  ]) {
    let calls = 0;
    const deps: CaliforniaFinanceDependencies = {
      sharedSources: new Map(),
      budget: { request() {} },
      fetch: async () => {
        calls++;
        throw error;
      },
    };
    await assert.rejects(
      collectCaliforniaFederalFinance({ race, member }, deps),
      (e) => e === error || e instanceof CaliforniaSourceUnavailable,
    );
    assert.equal(calls, 1);
  }
});
