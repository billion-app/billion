import assert from "node:assert/strict";
import { test } from "node:test";

import type { Candidate, Contest } from "./civic";
import type {
  CanonicalMeasure,
  MeasureCitation,
  SourceTier,
} from "./measure-sources/types";
import {
  mergeCandidateEnrichment,
  mergeMeasureCitations,
} from "./civic-enrichment-merge";

function citation(field: string, tier: SourceTier): MeasureCitation {
  return {
    field,
    tier,
    sourceName: tier,
    sourceUrl: `https://example.org/${tier}`,
    official: tier === "state_sos",
  };
}

void test("lower/equal-tier cached enrichment cannot replace provider fields or their citations", () => {
  for (const tier of ["vote_smart", "wikipedia", "ballotpedia"] as const) {
    const candidate: Candidate = {
      name: "Fixture",
      incumbent: false,
      candidateUrl: "https://example.org/campaign",
      ballotStatus: "withdrewStillOnBallot",
      citations: [
        citation("incumbent", "ballotpedia"),
        citation("candidateUrl", "ballotpedia"),
      ],
    };
    mergeCandidateEnrichment(candidate, {
      name: "Different name",
      incumbent: true,
      candidateUrl: "https://example.org/office",
      biography: "Sourced biography",
      citations: [
        citation("incumbent", tier),
        citation("candidateUrl", tier),
        citation("biography", tier),
      ],
    });
    assert.equal(candidate.incumbent, false);
    assert.equal(candidate.candidateUrl, "https://example.org/campaign");
    assert.equal(candidate.name, "Fixture");
    assert.equal(candidate.ballotStatus, "withdrewStillOnBallot");
    assert.equal(candidate.biography, "Sourced biography");
    assert.deepEqual(candidate.citations, [
      citation("incumbent", "ballotpedia"),
      citation("candidateUrl", "ballotpedia"),
      citation("biography", tier),
    ]);
  }
});

void test("higher-tier enrichment replaces the value and citation together, including false", () => {
  const candidate: Candidate = {
    name: "Fixture",
    incumbent: true,
    citations: [citation("incumbent", "ballotpedia")],
  };
  mergeCandidateEnrichment(candidate, {
    name: "Fixture",
    incumbent: false,
    citations: [citation("incumbent", "state_sos")],
  });
  assert.equal(candidate.incumbent, false);
  assert.deepEqual(candidate.citations, [citation("incumbent", "state_sos")]);
});

void test("empty and uncited enrichment does not erase cited provider values", () => {
  const candidate: Candidate = {
    name: "Fixture",
    phone: "555-0100",
    email: "test@example.org",
    citations: [
      citation("phone", "ballotpedia"),
      citation("email", "ballotpedia"),
    ],
  };
  const before = structuredClone(candidate);
  mergeCandidateEnrichment(candidate, {
    name: "Fixture",
    phone: "",
    email: "uncited@example.org",
    citations: [citation("phone", "state_sos")],
  });
  assert.deepEqual(candidate, before);
});

const enrichedMeasure: CanonicalMeasure = {
  title: "Fixture",
  summary: "Official summary",
  fullText: "Different official text",
  proArguments: [],
  conArguments: [],
  citations: [
    citation("summary", "state_sos"),
    citation("fullText", "state_sos"),
  ],
};
void test("retained provider ballot text keeps its actual citation when another source wins fullText", () => {
  const contest: Contest = {
    type: "referendum",
    referendumText: "Provider ballot question",
    citations: [
      citation("summary", "ballotpedia"),
      citation("referendumText", "ballotpedia"),
    ],
  };
  assert.deepEqual(mergeMeasureCitations(contest, enrichedMeasure), [
    citation("summary", "state_sos"),
    citation("referendumText", "ballotpedia"),
  ]);
  assert.equal(contest.referendumText, "Provider ballot question");
});
void test("backfilled measure text uses the winning source under the surfaced field name", () => {
  assert.deepEqual(
    mergeMeasureCitations({ type: "referendum" }, enrichedMeasure),
    [citation("summary", "state_sos"), citation("referendumText", "state_sos")],
  );
});
