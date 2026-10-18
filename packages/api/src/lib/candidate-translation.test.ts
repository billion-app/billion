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
