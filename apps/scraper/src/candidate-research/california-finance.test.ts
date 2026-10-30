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
const profile =
  "MCGUIRE, MIKE Candidate for House California - 1 ID: H6CA01269 Data is included from these committees: TEST COMMITTEE (C00503185) Total raised Coverage dates: 01/01/2025 to 06/30/2026 Total receipts $100.00 Total individual contributions $70.00 Party committee contributions $5.00 Other committee contributions $5.00 Candidate contributions $5.00 Transfers from other authorized committees $5.00 Loans made by candidate $5.00 Other loans $1.00 Offsets to operating expenditures $1.00 Other receipts $3.00 Newly filed summary data may not appear for up to 48 hours. Total contribution refunds $2.00";
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
function page(
  results: unknown[],
  options: { count?: number; pages?: number; page?: number } = {},
) {
  return {
    results,
    pagination: {
      count: options.count ?? results.length,
      pages: options.pages ?? 1,
      page: options.page ?? 1,
      is_count_exact: true,
    },
  };
}
function fixture(index = page([candidate])) {
  const calls: { url: string; apiKey?: string }[] = [];
  let requests = 0;
  const deps: CaliforniaFinanceDependencies = {
    sharedSources: new Map(),
    budget: {
      request() {
        requests++;
      },
    },
    fetch: async (id, url, _publisher, format, apiKey) => {
      calls.push({ url, apiKey });
      if (url.includes("candidates/search/"))
        return source(id, url, format, index);
      if (url.includes("www.fec.gov")) return source(id, url, format, profile);
      throw new Error("No API itemized fixture configured");
    },
  };
  return { deps, calls, requests: () => requests };
}
test("exact contextual FEC identity uses the shared district index and reconciled public summary", async () => {
  const { deps, calls, requests } = fixture();
  const result = await collectCaliforniaFederalFinance({ race, member }, deps);
  assert.equal(result.identityProof?.candidateId, candidate.candidate_id);
  assert.equal(result.finance?.receipts?.totalCents, 10000);
  assert.equal(result.finance?.donorCoverage, "unavailable");
  assert.equal(result.finance?.outsideSpending, null);
  assert.equal(result.gap, null);
  assert.equal(result.evidence.length, 2);
  for (const evidence of result.evidence)
    assert(
      result.sources.some(
        (s) =>
          s.url === evidence.url &&
          s.contentHash === evidence.contentHash &&
          s.text.includes(evidence.excerpt),
      ),
    );
  const index = new URL(calls[0]!.url);
  assert.equal(index.searchParams.get("office"), "H");
  assert.equal(index.searchParams.get("state"), "CA");
  assert.equal(index.searchParams.get("district"), "01");
  assert.equal(index.searchParams.get("cycle"), "2026");
  assert.equal(index.searchParams.get("election_year"), "2026");
  assert.equal(calls[0]?.apiKey, "DEMO_KEY");
  assert.equal(
    calls.some((call) => call.url.includes("DEMO_KEY")),
    false,
  );
  await collectCaliforniaFederalFinance({ race, member }, deps);
  assert.equal(requests(), 2);
  assert.equal(calls.length, 2);
});
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
test("unresolved identities, incomplete indexes and API outages remain explicit gaps", async () => {
  for (const index of [
    page([{ ...candidate, district: "17" }]),
    page([candidate, { ...candidate, candidate_id: "H6CA01277" }]),
    page([candidate], { count: 201, pages: 3 }),
    page([candidate], { count: 2 }),
  ]) {
    const f = fixture(index);
    const result = await collectCaliforniaFederalFinance(
      { race, member },
      f.deps,
    );
    assert.equal(result.finance, null);
    assert.equal(result.evidence.length, 0);
    assert.ok(result.gap);
    assert.equal(f.calls.length, 1);
  }
  const f = fixture();
  f.deps.fetch = async () => {
    throw new Error("HTTP 429");
  };
  const result = await collectCaliforniaFederalFinance(
    { race, member },
    f.deps,
  );
  assert.match(result.gap ?? "", /request or validation failed/);
  assert.equal(result.finance, null);
});
test("index pagination stops at two pages and resolves only after the full bounded result", async () => {
  const f = fixture();
  const others = Array.from({ length: 100 }, (_, i) => ({
    ...candidate,
    candidate_id: `H${String(i).padStart(8, "0")}`,
    name: `OTHER, PERSON ${i}`,
  }));
  f.deps.fetch = async (id, url, _publisher, format) => {
    f.calls.push({ url });
    if (url.includes("www.fec.gov")) return source(id, url, format, profile);
    const second = new URL(url).searchParams.get("page") === "2";
    return source(
      id,
      url,
      format,
      page(second ? [candidate] : others, {
        count: 101,
        pages: 2,
        page: second ? 2 : 1,
      }),
    );
  };
  const result = await collectCaliforniaFederalFinance(
    { race, member },
    f.deps,
  );
  assert.equal(result.finance?.receipts?.totalCents, 10000);
  assert.equal(f.calls.length, 3);
  assert.equal(result.identityProof?.sourceId, result.sources[1]?.id);
});
test("public summary district 17 cannot masquerade as district 1 and missing amounts stay unavailable", async () => {
  for (const changed of [
    profile.replace("California - 1", "California - 17"),
    profile.replace("Other receipts $3.00", ""),
    profile.replace("06/30/2026", "06/30/2024"),
  ]) {
    const f = fixture();
    const fetch = f.deps.fetch;
    f.deps.fetch = (id, url, publisher, format, key) =>
      url.includes("www.fec.gov")
        ? Promise.resolve(source(id, url, format, changed))
        : fetch(id, url, publisher, format, key);
    const result = await collectCaliforniaFederalFinance(
      { race, member },
      f.deps,
    );
    assert.ok(result.identityProof);
    assert.equal(result.finance, null);
    assert.equal(result.evidence.length, 0);
    assert.match(result.gap ?? "", /not zero/);
  }
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
test("a configured API key reuses typed processed totals while rejecting cross-candidate committees", async () => {
  for (const wrongCommittee of [false, true]) {
    const f = fixture();
    f.deps.apiKey = "synthetic-key";
    const fallback = f.deps.fetch;
    f.deps.fetch = async (id, url, publisher, format, key) => {
      if (url.includes("candidates/search/") || url.includes("www.fec.gov"))
        return fallback(id, url, publisher, format, key);
      f.calls.push({ url, apiKey: key });
      if (url.includes("/totals/"))
        return source(
          id,
          url,
          format,
          page([
            {
              candidate_id: candidate.candidate_id,
              cycle: 2026,
              coverage_start_date: "2025-01-01",
              coverage_end_date: "2026-06-30",
              receipts: 300,
              contribution_refunds: 10,
              individual_contributions: 200,
              other_political_committee_contributions: 100,
              political_party_committee_contributions: 0,
              candidate_contribution: 0,
              loans_made_by_candidate: 0,
              transfers_from_other_authorized_committee: 0,
              all_other_loans: 0,
              offsets_to_operating_expenditures: 0,
              other_receipts: 0,
            },
          ]),
        );
      if (url.includes("/committees/"))
        return source(
          id,
          url,
          format,
          page([
            {
              designation: "P",
              candidate_ids: [
                wrongCommittee ? "H99999999" : candidate.candidate_id,
              ],
              committee_id: "C00503185",
              name: "Synthetic committee",
            },
          ]),
        );
      if (url.includes("/schedules/")) return source(id, url, format, page([]));
      return source(id, url, format, page([candidate]));
    };
    const result = await collectCaliforniaFederalFinance(
      { race, member },
      f.deps,
    );
    assert.equal(
      result.finance?.receipts?.totalCents,
      wrongCommittee ? 10000 : 30000,
    );
    assert.equal(
      result.finance?.donorCoverage,
      wrongCommittee ? "unavailable" : "selected",
    );
    assert.ok(f.calls.length <= 8);
    for (const call of f.calls.filter((call) =>
      call.url.includes("api.open.fec.gov"),
    ))
      assert.equal(call.apiKey, "synthetic-key");
  }
});
