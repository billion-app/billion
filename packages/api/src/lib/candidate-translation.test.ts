import assert from "node:assert/strict";
import test from "node:test";

import type { PublishedCandidateRace } from "./candidate-race-release";
import { candidateSegments } from "./candidate-translation";
import { applySegments } from "./content-translation";

void test("candidate readers include explanations, promises and finance; originals and identity remain verbatim", () => {
  const point = {
    title: "What changes",
    text: "Adds oversight",
    emphasis: ["oversight"],
    evidenceIds: ["source"],
  };
  const race = {
    manifest: {
      id: "release",
      office: "Governor",
      jurisdictionLabel: "California",
      members: [
        {
          candidateId: "person",
          name: "Alex Example",
          revisionDigest: "original-digest",
        },
      ],
    },
    reviewedAt: "2026-10-01",
    briefs: [
      {
        identity: { candidateId: "person" },
        revisionId: "revision",
        evidence: [
          {
            title: "Source title",
            publisher: "Publisher",
            excerpt: "Original quotation",
            locator: "Page 3",
            url: "https://example.com",
            shows: "Documents a vote",
            limits: "Not a forecast",
          },
        ],
        sections: [
          {
            claims: [{ id: "claim", ...point }],
            missingEvidence: "No record found",
          },
        ],
        research: {
          terms: [{ term: "Appropriation", plain: "Permission to spend" }],
          promises: [
            {
              title: "Add staff",
              brief: { change: point, authority: point, unknowns: point },
              benefits: [point],
              costs: [point],
              affected: [point],
              perspectives: [point],
              steps: [point],
              alternatives: [point],
              unknowns: [point],
            },
          ],
          financeGap: "No filing",
          finance: {
            committeeName: "Example Committee",
            coverageNote: "Partial period",
            donors: [
              {
                name: "Example Donor",
                amountCents: 100,
                lobbying: point,
                positions: [point],
              },
            ],
          },
        },
        correction: { reason: "Corrected date" },
      },
    ],
  };
  const segments = candidateSegments(race as unknown as PublishedCandidateRace);
  for (const key of [
    "race.briefs.0.sections.0.claims.0.text",
    "race.briefs.0.sections.0.missingEvidence",
    "race.briefs.0.research.promises.0.brief.authority.text",
    "race.briefs.0.research.promises.0.unknowns.0.text",
    "race.briefs.0.research.finance.donors.0.lobbying.text",
    "race.briefs.0.evidence.0.shows",
  ])
    assert.ok(
      segments.some((s) => s.key === key),
      key,
    );
  assert.ok(
    !segments.some((s) =>
      /excerpt|publisher|locator|\.url|\.name|committeeName|Digest|reviewedAt|revisionId/.test(
        s.key,
      ),
    ),
  );
  const result = applySegments(
    race,
    Object.fromEntries(segments.map((s) => [s.key, `中文 ${s.text}`])),
    "race",
  );
  assert.equal(result.briefs[0]?.evidence[0]?.excerpt, "Original quotation");
  assert.deepEqual(result.manifest.members, race.manifest.members);
  assert.equal(result.briefs[0].research.finance.donors[0]?.amountCents, 100);
  assert.equal(race.briefs[0]?.sections[0]?.claims[0]?.text, "Adds oversight");
});

for (const status of ["available", "unavailable"] as const) {
  void test(`finance ${status} explanations translate while source records remain verbatim`, () => {
    const window = {
      status: "available" as const,
      periodStart: "2026-01-01",
      periodEnd: "2026-09-30",
      updatedAt: "2026-10-01T00:00:00Z",
      evidenceIds: ["finance-source"],
    };
    const available = {
      summary: {
        ...window,
        basis: "reported_campaign_totals",
        spentCents: 1200,
        cashCents: 3400,
        debtCents: null,
        itemizedIndividualCents: 1000,
        unitemizedIndividualCents: 500,
      },
      donorSelection: {
        ...window,
        basis: "selected_filing_transactions",
        selection:
          "Selected positive, nonmemo contributions from recent reports",
        filingNumbers: [1234567],
        limit: 20,
      },
      independentExpenditures: {
        ...window,
        basis: "processed_periodic_reports",
        completeness: "complete",
        supportCents: 5000,
        opposeCents: 6000,
        transactionCount: 2,
      },
      filingStatus: {
        ...window,
        basis: "official_filing_index",
        kind: "committee_threshold_statement",
        latestForm: "F99",
        observedForms: ["F1", "F99"],
        statement:
          "The committee has not exceeded $5,000 in receipts or expenditures.",
      },
    };
    const unavailable = (reason: string) => ({
      status: "unavailable" as const,
      reason,
      evidenceIds: ["finance-source"],
    });
    const observation =
      status === "available"
        ? { schemaVersion: 1, ...available }
        : {
            schemaVersion: 1,
            summary: unavailable("No financial report with totals was found"),
            donorSelection: unavailable("No itemized contributions were found"),
            independentExpenditures: unavailable(
              "No spending records were found",
            ),
            filingStatus: unavailable("No official filing history was found"),
          };
    const finance = {
      committeeName: "Example Committee",
      committeeId: "C00000001",
      ...window,
      coverageNote: "The reviewed source coverage is limited",
      receipts: { totalCents: 1500 },
      donors: [{ id: "donor-1", name: "Example Donor", amountCents: 1000 }],
      observation,
    };
    const race = {
      manifest: { id: "release" },
      briefs: [
        {
          research: { finance },
          evidence: [
            {
              id: "finance-source",
              excerpt: "Original source quotation with $5,000",
              shows: "Explains financial coverage",
              limits: "Does not establish exact totals",
            },
          ],
        },
      ],
    };
    const segments = candidateSegments(
      race as unknown as PublishedCandidateRace,
    );
    const financeKeys = segments
      .map((segment) => segment.key)
      .filter((key) => key.includes(".finance."));
    const prefix = "race.briefs.0.research.finance.";
    assert.deepEqual(
      financeKeys.sort(),
      [
        `${prefix}coverageNote`,
        ...(status === "available"
          ? [`${prefix}observation.donorSelection.selection`]
          : [
              "summary",
              "donorSelection",
              "independentExpenditures",
              "filingStatus",
            ].map((component) => `${prefix}observation.${component}.reason`)),
      ].sort(),
    );
    const translations = Object.fromEntries(
      segments.map((segment) => [segment.key, `中文 ${segment.text}`]),
    );
    const localized = applySegments(race, translations, "race");
    const expected = structuredClone(race);
    const expectedBrief = expected.briefs[0];
    assert.ok(expectedBrief);
    const expectedEvidence = expectedBrief.evidence[0];
    assert.ok(expectedEvidence);
    expectedBrief.research.finance.coverageNote = `中文 ${finance.coverageNote}`;
    if (
      expectedBrief.research.finance.observation.donorSelection.status ===
      "available"
    ) {
      expectedBrief.research.finance.observation.donorSelection.selection = `中文 ${available.donorSelection.selection}`;
    } else {
      for (const component of [
        "summary",
        "donorSelection",
        "independentExpenditures",
        "filingStatus",
      ] as const) {
        const part = expectedBrief.research.finance.observation[component];
        if (part.status === "unavailable") part.reason = `中文 ${part.reason}`;
      }
    }
    expectedEvidence.shows = "中文 Explains financial coverage";
    expectedEvidence.limits = "中文 Does not establish exact totals";
    assert.deepEqual(localized, expected);
    assert.equal(
      race.briefs[0]?.research.finance.coverageNote,
      finance.coverageNote,
    );
  });
}
