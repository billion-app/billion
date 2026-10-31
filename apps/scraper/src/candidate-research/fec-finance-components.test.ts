import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type {
  CampaignFinance,
  CandidateBrief,
  ResearchSource,
} from "@acme/validators";
import { campaignFinanceSchema } from "@acme/validators";

import {
  authorCaliforniaBrief,
  californiaModelInput,
} from "./california-ai.js";
import { buildCaliforniaDossier } from "./california-dossier.js";
import {
  fecScheduleALayout,
  selectFecFilingContributions,
} from "./fec-filing-transactions.js";
import {
  applyIndependentExpenditures,
  applyReportedContributions,
  collectCommitteeReportingStatus,
  exactFecRows,
  fecBatchUrl,
} from "./fec-finance-components.js";
import { profileFinance } from "./profile.js";
import { hash } from "./sources.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/six-candidate-finance.json", import.meta.url),
    "utf8",
  ),
) as {
  reports: {
    results: Record<string, unknown>[];
    pagination: Record<string, unknown>;
  };
  outside: {
    results: Record<string, unknown>[];
    pagination: Record<string, unknown>;
  };
  filingIndex: unknown;
  raw: Record<string, { text: string; originalByteHash: string }>;
  profiles: Record<
    string,
    { url: string; text: string; originalByteHash: string }
  >;
};
const candidateIds = [
  "H0CA10073",
  "H4CA16197",
  "H6CA10187",
  "H6CA16176",
  "H6CA19154",
  "H6CA20152",
];
const now = "2026-10-31T20:00:00.000Z";
function source(url: string, value: unknown): ResearchSource {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return {
    id: hash(url).slice(0, 20),
    url,
    format: url.endsWith(".fec") ? "text" : "json",
    text,
    contentHash: hash(text),
    publisher: "Federal Election Commission",
    fetchedAt: now,
  };
}
function finance(): CampaignFinance {
  return campaignFinanceSchema.parse({
    committeeId: "C00592154",
    committeeName: "Committee",
    periodStart: "2025-01-01",
    periodEnd: "2026-10-14",
    currency: "USD",
    coverage: "partial",
    coverageNote: "Fixture summary",
    updatedAt: now,
    filingEvidenceIds: ["summary"],
    receipts: null,
    donors: [],
    donorCoverage: "unavailable",
    outsideSpending: null,
    observation: {
      schemaVersion: 1,
      summary: {
        status: "unavailable",
        reason: "No summary in parser fixture",
        evidenceIds: ["summary"],
      },
      donorSelection: {
        status: "unavailable",
        reason: "Not collected",
        evidenceIds: ["summary"],
      },
      independentExpenditures: {
        status: "unavailable",
        reason: "Not collected",
        evidenceIds: ["summary"],
      },
      filingStatus: {
        status: "unavailable",
        reason: "Not collected",
        evidenceIds: ["summary"],
      },
    },
  });
}
function raw(fileNumber: number) {
  const value = fixture.raw[String(fileNumber)];
  assert(value);
  return source(
    `https://docquery.fec.gov/dcdev/posted/${fileNumber}.fec`,
    value.text,
  );
}

test("actual latest five official filing projections yield useful selected transactions without home addresses", () => {
  const expected = new Map([
    ["C00592154", 10],
    ["C00902841", 2],
    ["C00936435", 1],
    ["C00554709", 10],
    ["C00858688", 10],
  ]);
  for (const [committeeId, count] of expected) {
    const row = fixture.reports.results.find(
      (r) => r.committee_id === committeeId,
    )!;
    const report = {
      committeeId,
      fileNumber: Number(row.file_number),
      periodStart: String(row.coverage_start_date).slice(0, 10),
      periodEnd: String(row.coverage_end_date).slice(0, 10),
    };
    const value = selectFecFilingContributions({
      source: raw(report.fileNumber),
      report,
      candidateId: "candidate",
      limit: 10,
      layout: fecScheduleALayout,
    });
    assert.equal(value.donors.length, count);
    assert(value.donors.every((d) => d.amountCents > 0));
    assert(!JSON.stringify(value.evidence).includes("street_1"));
    assert(
      value.sources.every(
        (s) => !s.text.includes("street_1") && !s.text.includes("employer"),
      ),
    );
    assert(new Set(value.donors.map((d) => d.id)).size === count);
  }
});

test("raw filing committee, coverage, version and conflicting transactions fail closed", () => {
  const row = fixture.reports.results[0]!;
  const report = {
    committeeId: String(row.committee_id),
    fileNumber: Number(row.file_number),
    periodStart: String(row.coverage_start_date).slice(0, 10),
    periodEnd: String(row.coverage_end_date).slice(0, 10),
  };
  const original = raw(report.fileNumber);
  for (const text of [
    original.text.replace("8.5", "8.4"),
    original.text.replace(report.committeeId, "C99999999"),
    original.text.replace("20261014", "20261013"),
  ])
    assert.throws(() =>
      selectFecFilingContributions({
        source: { ...original, text },
        report,
        candidateId: "candidate",
        limit: 10,
        layout: fecScheduleALayout,
      }),
    );
});

test("processed report selection preserves latest amendments and deterministic selected transactions", async () => {
  const f = finance();
  const sources: ResearchSource[] = [];
  const citations: CandidateBrief["evidence"] = [];
  const reportUrl = new URL(
    fecBatchUrl(
      "reports/house-senate/",
      2026,
      "committee_id",
      fixture.reports.results.map((row) => String(row.committee_id)),
    ),
  );
  reportUrl.searchParams.set("most_recent", "true");
  const input = {
    source: source(reportUrl.toString(), fixture.reports),
    committeeIds: ["C00592154"],
    candidateId: "H6CA20152",
    cycle: 2026,
    finance: f,
    get: async (url: string) => raw(Number(/\/(\d+)\.fec$/.exec(url)![1])),
    sources,
    evidence: citations,
    layout: fecScheduleALayout,
  };
  assert(await applyReportedContributions(input));
  assert.equal(f.donors.length, 10);
  assert.equal(f.observation?.donorSelection.status, "available");
  assert.equal(f.donorAmounts, "contribution");
  const index = sources.find(
    (entry) => entry.id === "H6CA20152:financial-report-index",
  )!;
  const proof = JSON.parse(index.text) as {
    query: { cycle: number; committee_ids: string[]; most_recent: boolean };
    pagination: Record<string, unknown>;
    reports: {
      committee_id: string;
      file_number: number;
      report_form: string;
    }[];
  };
  assert.equal(proof.reports.length, fixture.reports.results.length);
  assert.deepEqual(proof.pagination, fixture.reports.pagination);
  assert.deepEqual(proof.query, {
    cycle: 2026,
    committee_ids: reportUrl.searchParams.getAll("committee_id"),
    most_recent: true,
  });
  assert.deepEqual(
    proof.reports,
    fixture.reports.results.map((row) => ({
      committee_id: row.committee_id,
      file_number: row.file_number,
      report_form: row.report_form,
    })),
  );
  const status = f.observation!.filingStatus;
  assert.equal(status.status, "available");
  if (status.status !== "available") throw Error();
  assert.deepEqual(status.observedForms, [
    `Form 3 (${proof.reports.filter((row) => row.committee_id === "C00592154").length} filings)`,
  ]);
  assert(status.evidenceIds.includes(index.id));
  assert(!f.observation!.donorSelection.evidenceIds.includes(index.id));
  assert.equal(index.url, input.source.url);
  assert.equal(index.publisher, input.source.publisher);
  assert.equal(index.fetchedAt, input.source.fetchedAt);
  assert.equal(index.contentHash, hash(index.text));
  assert(index.text.length <= 4000);
  const changed = structuredClone(fixture.reports);
  changed.results[0]!.most_recent = false;
  await assert.rejects(
    applyReportedContributions({
      ...input,
      source: source(input.source.url, changed),
    }),
    /latest processed amendment/,
  );
});

test("exact candidate batch partitions outside totals and proves an empty candidate result", () => {
  const s = source(
    fecBatchUrl(
      "schedules/schedule_e/by_candidate/",
      2026,
      "candidate_id",
      candidateIds,
    ),
    fixture.outside,
  );
  for (const candidateId of candidateIds) {
    const f = finance();
    const sources: ResearchSource[] = [];
    const citations: CandidateBrief["evidence"] = [];
    applyIndependentExpenditures({
      source: s,
      candidateId,
      candidateIds,
      cycle: 2026,
      finance: f,
      sources,
      evidence: citations,
    });
    campaignFinanceSchema.parse(f);
    const part = f.observation!.independentExpenditures;
    assert.equal(part.status, "available");
    if (part.status !== "available") throw Error();
    assert.equal(part.periodEnd, "2026-12-31");
    assert.equal(part.periodStart, "2025-01-01");
    assert.equal(part.opposeCents, 0);
    assert.equal(
      part.supportCents,
      candidateId === "H6CA20152"
        ? 59954818
        : ["H0CA10073", "H4CA16197"].includes(candidateId)
          ? 1000
          : 0,
    );
    assert(citations.length > 0);
    const scopeId = `${candidateId}:outside:scope`;
    assert(part.evidenceIds.includes(scopeId));
    const scope = citations.find((entry) => entry.id === scopeId)!;
    assert.equal(scope.excerpt, s.text);
    assert.equal(scope.contentHash, s.contentHash);
    assert.equal(scope.retrievedAt, s.fetchedAt);
    assert.equal(scope.origin, "primary_record");
    if (f.outsideSpending!.length)
      assert(part.evidenceIds.some((id) => id !== scopeId));
  }
  for (const change of [
    { pagination: { ...fixture.outside.pagination, is_count_exact: false } },
    { pagination: { ...fixture.outside.pagination, count: 6 } },
    { pagination: { ...fixture.outside.pagination, pages: 2 } },
  ])
    assert.throws(
      () => exactFecRows(source(s.url, { ...fixture.outside, ...change })),
      /exactly exhausted/,
    );
  const f = finance();
  assert.throws(
    () =>
      applyIndependentExpenditures({
        source: s,
        candidateId: "H6CA10187",
        candidateIds: ["H6CA10187"],
        cycle: 2026,
        finance: f,
        sources: [],
        evidence: [],
      }),
    /scope/,
  );
});

test("report index rejects duplicate filing identities and incomplete query proofs before raw retrieval", async () => {
  const committees = [
    ...new Set(fixture.reports.results.map((row) => String(row.committee_id))),
  ];
  const url = new URL(
    fecBatchUrl("reports/house-senate/", 2026, "committee_id", committees),
  );
  url.searchParams.set("most_recent", "true");
  const duplicate = structuredClone(fixture.reports);
  const first = duplicate.results[0]!;
  duplicate.results.push({
    ...first,
    coverage_start_date: "2025-02-01T00:00:00",
  });
  duplicate.pagination.count = duplicate.results.length;
  const invalidIdentity = structuredClone(fixture.reports);
  invalidIdentity.results.find(
    (row) => row.committee_id !== "C00592154",
  )!.file_number = null;
  const wrongForm = structuredClone(fixture.reports);
  wrongForm.results.find(
    (row) => row.committee_id !== "C00592154",
  )!.report_form = "Form 99";
  const foreignCommittee = structuredClone(fixture.reports);
  foreignCommittee.results[0]!.committee_id = "C99999999";
  const foreignCycle = structuredClone(fixture.reports);
  foreignCycle.results.find((row) => row.committee_id !== "C00592154")!.cycle =
    2024;
  const truncated = structuredClone(fixture.reports);
  truncated.results.pop();
  const inexact = structuredClone(fixture.reports);
  inexact.pagination.is_count_exact = false;
  for (const value of [
    duplicate,
    invalidIdentity,
    wrongForm,
    foreignCommittee,
    foreignCycle,
    truncated,
    inexact,
  ]) {
    let requests = 0;
    await assert.rejects(
      applyReportedContributions({
        source: source(url.toString(), value),
        committeeIds: ["C00592154"],
        candidateId: "H6CA20152",
        cycle: 2026,
        finance: finance(),
        get: async () => {
          requests++;
          throw new Error("Raw retrieval must not start");
        },
        sources: [],
        evidence: [],
        layout: fecScheduleALayout,
      }),
      /filing identity|unrequested committee|exactly exhausted|latest processed amendment/,
    );
    assert.equal(requests, 0);
  }
});

test("report and expenditure query proofs keep the evidence bound instead of clipping", async () => {
  const committees = [
    ...new Set(fixture.reports.results.map((row) => String(row.committee_id))),
  ];
  const reportsUrl = new URL(
    fecBatchUrl("reports/house-senate/", 2026, "committee_id", committees),
  );
  reportsUrl.searchParams.set("most_recent", "true");
  let requests = 0;
  await assert.rejects(
    applyReportedContributions({
      source: source(reportsUrl.toString(), {
        ...fixture.reports,
        pagination: { ...fixture.reports.pagination, extra: "x".repeat(4000) },
      }),
      committeeIds: ["C00592154"],
      candidateId: "H6CA20152",
      cycle: 2026,
      finance: finance(),
      get: async () => {
        requests++;
        throw new Error("Raw retrieval must not start");
      },
      sources: [],
      evidence: [],
      layout: fecScheduleALayout,
    }),
    /index proof exceeds evidence bound/,
  );
  assert.equal(requests, 0);
  assert.throws(
    () =>
      applyIndependentExpenditures({
        source: source(
          fecBatchUrl(
            "schedules/schedule_e/by_candidate/",
            2026,
            "candidate_id",
            candidateIds,
          ),
          {
            ...fixture.outside,
            extra: "x".repeat(4000),
          },
        ),
        candidateId: "H0CA10073",
        candidateIds,
        cycle: 2026,
        finance: finance(),
        sources: [],
        evidence: [],
      }),
    /query proof exceeds evidence bound/,
  );
});

test("mixed independent expenditure directions retain both row citations and complete query scope", () => {
  const row = structuredClone(
    fixture.outside.results.find(
      (value) => value.candidate_id === "H0CA10073",
    )!,
  );
  const value = {
    results: [row, { ...row, support_oppose_indicator: "O", total: 25 }],
    pagination: { count: 2, page: 1, pages: 1, is_count_exact: true },
  };
  const f = finance();
  const citations: CandidateBrief["evidence"] = [];
  const query = source(
    fecBatchUrl("schedules/schedule_e/by_candidate/", 2026, "candidate_id", [
      "H0CA10073",
    ]),
    value,
  );
  applyIndependentExpenditures({
    source: query,
    candidateId: "H0CA10073",
    candidateIds: ["H0CA10073"],
    cycle: 2026,
    finance: f,
    sources: [],
    evidence: citations,
  });
  const part = f.observation!.independentExpenditures;
  assert.equal(part.status, "available");
  if (part.status !== "available") throw Error();
  assert.equal(part.opposeCents, 2500);
  assert.equal(part.supportCents, 1000);
  assert.equal(part.evidenceIds.length, 3);
  assert.equal(
    citations.find((entry) => entry.id.endsWith(":scope"))!.excerpt,
    query.text,
  );
});

test("an unqueried candidate cannot receive zero spending from another candidate's complete response", () => {
  const f = finance();
  const original = structuredClone(f);
  const sources: ResearchSource[] = [];
  const citations: CandidateBrief["evidence"] = [];
  const query = source(
    fecBatchUrl("schedules/schedule_e/by_candidate/", 2026, "candidate_id", [
      "H0CA10073",
    ]),
    {
      results: [],
      pagination: { count: 0, page: 1, pages: 0, is_count_exact: true },
    },
  );
  assert.throws(
    () =>
      applyIndependentExpenditures({
        source: query,
        candidateId: "H6CA10187",
        candidateIds: ["H0CA10073"],
        cycle: 2026,
        finance: f,
        sources,
        evidence: citations,
      }),
    /candidate is outside query scope/,
  );
  assert.deepEqual(f, original);
  assert.deepEqual(sources, []);
  assert.deepEqual(citations, []);
});

test("actual Frese filing status preserves no financial totals and no donor assumptions", async () => {
  const citations: CandidateBrief["evidence"] = [];
  const sources: ResearchSource[] = [];
  const url = new URL(
    fecBatchUrl("filings/", 2026, "committee_id", ["C00929612"]),
  );
  url.searchParams.set("most_recent", "true");
  const f = await collectCommitteeReportingStatus({
    index: source(url.toString(), fixture.filingIndex),
    committeeId: "C00929612",
    committeeName: "FRESE FOR CONGRESS",
    candidateId: "H6CA10187",
    cycle: 2026,
    get: async () => raw(2028712),
    sources,
    evidence: citations,
  });
  assert.equal(f.receipts, null);
  assert.deepEqual(f.donors, []);
  assert.equal(f.observation?.summary.status, "unavailable");
  assert.equal(f.observation?.filingStatus.status, "available");
  const part = f.observation!.filingStatus;
  if (part.status === "available") {
    assert.equal(part.kind, "committee_threshold_statement");
    assert.equal(part.periodEnd, "2026-10-14");
    assert.deepEqual(part.observedForms, ["F1 (1 filing)", "F99 (3 filings)"]);
    assert.match(part.statement!, /not received contributions/);
  }
  assert.throws(
    () =>
      campaignFinanceSchema.parse({
        ...f,
        receipts: {
          totalCents: 0,
          breakdown: {
            individuals: 0,
            committees: 0,
            self_contributions: 0,
            candidate_loans: 0,
            transfers: 0,
            other: 0,
          },
          refundsCents: null,
        },
      }),
    /threshold/,
  );
});

test("legacy finance parsing preserves absent observation fields and its exact JSON", () => {
  const value = finance();
  delete value.observation;
  assert.deepEqual(campaignFinanceSchema.parse(value), value);
  assert(!("observation" in campaignFinanceSchema.parse(value)));
});

test("actual five FEC summaries retain reported spending cash debt and itemization while Frese stays absent", () => {
  const names: Record<string, { name: string; district: string }> = {
    H0CA10073: { name: "DESAULNIER, MARK", district: "10" },
    H4CA16197: { name: "LICCARDO, SAM T.", district: "16" },
    H6CA16176: { name: "SOULE, PETER SUNDIN MR.", district: "16" },
    H6CA19154: { name: "VERBICA, PETER COE", district: "19" },
    H6CA20152: { name: "PANETTA, JIMMY", district: "19" },
  };
  for (const [id, identity] of Object.entries(names)) {
    const captured = fixture.profiles[id]!;
    const s = {
      ...source(captured.url, captured.text),
      format: "html" as const,
    };
    const finance = profileFinance(
      s,
      {
        fecId: id,
        fecName: identity.name,
        district: identity.district,
        cycle: 2026,
      },
      [],
    );
    assert.equal(finance.periodEnd, "2026-10-14");
    const summary = finance.observation!.summary;
    assert.equal(summary.status, "available");
    if (summary.status === "available")
      for (const key of [
        "spentCents",
        "cashCents",
        "debtCents",
        "itemizedIndividualCents",
        "unitemizedIndividualCents",
      ] as const)
        assert.equal(typeof summary[key], "number");
    assert(finance.receipts!.totalCents > 0);
  }
  const captured = fixture.profiles.H6CA10187!;
  assert.throws(() =>
    profileFinance(
      { ...source(captured.url, captured.text), format: "html" },
      {
        fecId: "H6CA10187",
        fecName: "FRESE, JEFFREY",
        district: "10",
        cycle: 2026,
      },
      [],
    ),
  );
});

test("six actual source observations replay through one collector with only three shared API requests", async () => {
  const { collectCaliforniaFederalFinance } =
    await import("./california-finance.js");
  const { fecCandidateMasterUrl } = await import("@acme/validators");
  type Race = import("@acme/validators").CaliforniaRaceTarget;
  const rawFixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/six-candidate-finance.json", import.meta.url),
      "utf8",
    ),
  ) as {
    masterProjection: string;
    identitySources: {
      id: string;
      url: string;
      format: ResearchSource["format"];
      text: string;
    }[];
  };
  const rows = [
    {
      district: "10",
      members: [
        ["Mark DeSaulnier", "3507"],
        ["Jeff Frese", "3576"],
      ],
    },
    {
      district: "16",
      members: [
        ["Sam Liccardo", "3360"],
        ["Peter Sundin Soulé", "3405"],
      ],
    },
    {
      district: "19",
      members: [
        ["Jimmy Panetta", "3342"],
        ["Peter Coe Verbica", "3373"],
      ],
    },
  ];
  const scope: Race[] = rows.map((row) => {
    const contestId = `ca-sos:2026-11-03:110000${row.district}0000`;
    const jurisdiction = `ocd-division/country:us/state:ca/cd:${row.district}`;
    return {
      raceKey: contestId,
      contestId,
      jurisdiction,
      jurisdictionLabel: `California District ${row.district}`,
      electionDate: "2026-11-03",
      sourceContestId: `110000${row.district}0000`,
      officeFamily: "us_house",
      office: `United States Representative District ${row.district}`,
      district: row.district,
      kind: "election",
      rosterDigest: "a".repeat(64),
      members: row.members.map(([name, id]) => {
        const candidateId = `${contestId}:${id}`;
        return {
          name: name!,
          candidateId,
          sourceCandidateId: id!,
          partyCode: "01",
          party: "Democratic",
          ballotStatus: "on_ballot",
          identity: {
            candidateId,
            contestId,
            jurisdiction,
            electionDate: "2026-11-03",
          },
        };
      }),
    };
  });
  const identitySources: ResearchSource[] = rawFixture.identitySources.map(
    (value) => ({
      ...source(value.url, value.text),
      ...value,
      contentHash: hash(value.text),
    }),
  );
  const rosterText = readFileSync(
    new URL("./fixtures/C26GG.txt", import.meta.url),
    "utf8",
  );
  identitySources.push({
    ...source("https://media.sos.ca.gov/media/C26GG.txt", rosterText),
    format: "text",
  });
  const calls: string[] = [];
  const deps = {
    sharedSources: new Map<string, Promise<ResearchSource>>(),
    budget: { request() {} },
    fetch: async (
      _id: string,
      url: string,
      _publisher: string,
      format: ResearchSource["format"],
      key?: string,
    ) => {
      calls.push(url);
      assert(!url.includes("DEMO_KEY"));
      const u = new URL(url);
      if (url === fecCandidateMasterUrl(2026))
        return { ...source(url, rawFixture.masterProjection), format };
      if (u.hostname === "www.fec.gov") {
        const id = /\/candidate\/([^/]+)\//.exec(u.pathname)?.[1];
        assert(id);
        return { ...source(url, fixture.profiles[id]!.text), format };
      }
      if (u.hostname === "api.open.fec.gov") {
        assert.equal(key, "DEMO_KEY");
        if (u.pathname.includes("/reports/"))
          return source(url, fixture.reports);
        if (u.pathname.includes("/schedule_e/"))
          return source(url, fixture.outside);
        if (u.pathname.includes("/filings/"))
          return source(url, fixture.filingIndex);
      }
      if (u.hostname === "docquery.fec.gov")
        return raw(Number(/\/(\d+)\.fec$/.exec(url)![1]));
      throw new Error(`Unexpected source ${url}`);
    },
  };
  for (const race of scope)
    for (const member of race.members) {
      const result = await collectCaliforniaFederalFinance(
        { race, member, scope, identitySources },
        deps,
      );
      assert(result.finance, `${member.name}: ${result.gap}`);
      assert(result.identityProof);
      assert(result.sources.length <= 40);
      assert(result.evidence.length <= 100);
      const observation = result.finance.observation!;
      assert.equal(observation.independentExpenditures.status, "available");
      assert.equal(observation.filingStatus.status, "available");
      if (member.name === "Jeff Frese") {
        assert.equal(result.finance.receipts, null);
        assert.equal(result.finance.donors.length, 0);
        assert.equal(result.identityProof.bridge?.kind, "sos_legal_name_v1");
      } else {
        assert(result.finance.receipts);
        assert(result.finance.donors.length > 0);
        assert.equal(observation.donorSelection.status, "available");
      }
      if (member.name === "Sam Liccardo")
        assert.equal(result.identityProof.bridge?.kind, "official_domain_v1");
      for (const citation of result.evidence)
        assert(
          result.sources.some(
            (value) =>
              value.url === citation.url &&
              value.contentHash === citation.contentHash &&
              value.text.includes(citation.excerpt),
          ),
        );
      const roster = source(
        "https://example.ca.gov/fixture-roster",
        `${member.name} is listed for congressional district ${race.district}.`,
      );
      const dossier = buildCaliforniaDossier({
        identity: member.identity,
        name: member.name,
        officeFamily: "us_house",
        officeKind: "federal_legislative",
        rosterDigest: race.rosterDigest,
        researchVersion: "fixture-v1",
        createdAt: now,
        sources: [roster, ...result.sources],
        evidence: [
          {
            id: "fixture-roster",
            sourceId: roster.id,
            excerpt: roster.text,
            locator: "Synthetic unit-test roster",
            origin: "primary_record",
            role: "roster",
            identityQualification: "official_roster",
          },
          ...result.evidence.map((entry) => ({
            id: entry.id,
            sourceId: result.sources.find(
              (value) =>
                value.url === entry.url &&
                value.contentHash === entry.contentHash &&
                value.text.includes(entry.excerpt),
            )!.id,
            excerpt: entry.excerpt,
            locator: entry.locator,
            origin: entry.origin,
            role: "finance" as const,
            identityQualification: "exact_election_office" as const,
          })),
        ],
        finance: result.finance,
        financeIdentityProof: result.identityProof,
        gaps: [],
      });
      const empty = () => ({ claims: [] });
      const authored = await authorCaliforniaBrief(
        { dossier, policyVersion: "fixture-policy" },
        {
          now: () => now,
          invoke: async () => ({
            output: {
              priorities: empty(),
              record: empty(),
              mechanisms: empty(),
              effects: empty(),
              tradeoffs: empty(),
              unknowns: empty(),
              terms: [],
            },
            configuredModel: "fixture-author",
            actualModel: "fixture-author",
            provider: "fixture",
            requestId: "fixture-request",
            usage: { inputTokens: 1, outputTokens: 1 },
            costUsd: null,
          }),
        },
      );
      for (const brief of [undefined, authored.brief]) {
        const packet = californiaModelInput({
          dossier,
          policyVersion: "fixture-policy",
          brief,
        });
        assert(packet.bytes <= 120_000);
        const serialized = JSON.parse(packet.prompt) as {
          dossier: {
            sources: { id: string; contextWindows: { text: string }[] }[];
          };
        };
        const requiredProofIds = [
          `${result.identityProof.candidateId}:outside:scope`,
          ...(member.name === "Jeff Frese"
            ? []
            : [`${result.identityProof.candidateId}:financial-report-index`]),
        ];
        for (const id of requiredProofIds) {
          const citation = result.evidence.find((entry) => entry.id === id)!;
          assert(citation);
          const original = result.sources.find(
            (entry) =>
              entry.url === citation.url &&
              entry.contentHash === citation.contentHash,
          )!;
          assert(
            serialized.dossier.sources
              .find((entry) => entry.id === original.id)!
              .contextWindows.some((window) =>
                window.text.includes(citation.excerpt),
              ),
          );
        }
      }
    }
  assert.equal(
    calls.filter((url) => new URL(url).hostname === "api.open.fec.gov").length,
    3,
  );
  assert.equal(new Set(calls).size, calls.length);
});

test("memo conduit entries preserve earmarked individuals and conflicting transaction duplicates reject", () => {
  const row = fixture.reports.results[0]!;
  const report = {
    committeeId: String(row.committee_id),
    fileNumber: Number(row.file_number),
    periodStart: String(row.coverage_start_date).slice(0, 10),
    periodEnd: String(row.coverage_end_date).slice(0, 10),
  };
  const original = raw(report.fileNumber);
  const selectedLine = original.text.split("\n").find((line) => {
    const fields = line.split("\u001c");
    return fields[0] === "SA11AI" && fields[42] !== "X";
  })!;
  const fields = selectedLine.split("\u001c");
  const input = {
    source: original,
    report,
    candidateId: "candidate",
    limit: 10,
    layout: fecScheduleALayout,
  };
  const baseline = selectFecFilingContributions(input);
  assert(fields[3], "captured original contributor has conduit back reference");
  const duplicate = { ...original, text: original.text + selectedLine + "\n" };
  assert.deepEqual(
    selectFecFilingContributions({ ...input, source: duplicate }).donors,
    baseline.donors,
  );
  fields[20] = String(Number(fields[20]) + 1);
  assert.throws(
    () =>
      selectFecFilingContributions({
        ...input,
        source: {
          ...original,
          text: original.text + fields.join("\u001c") + "\n",
        },
      }),
    /Conflicting Schedule A/,
  );
  const memo = selectedLine.split("\u001c");
  memo[42] = "X";
  memo[2] = "MEMOONLY";
  assert.deepEqual(
    selectFecFilingContributions({
      ...input,
      source: { ...original, text: original.text + memo.join("\u001c") + "\n" },
    }).donors,
    baseline.donors,
  );
});
