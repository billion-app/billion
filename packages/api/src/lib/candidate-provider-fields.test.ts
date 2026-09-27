import assert from "node:assert/strict";
import { test } from "node:test";

import type { CanonicalCandidate, SourceTier } from "./candidate-sources/types";
import type { Candidate } from "./civic";
import { retainCandidateProviderFields } from "./candidate-provider-fields";

const provider: Candidate = {
  name: "Synthetic candidate",
  incumbent: false,
  candidateUrl: "https://example.org/campaign",
  citations: ["incumbent", "candidateUrl"].map((field) => ({
    field,
    sourceName: "Democracy Works / Ballotpedia",
    tier: "ballotpedia",
    official: false,
  })),
};

void test("lower-tier enrichment cannot replace provider values or their citations", () => {
  const enrichment: CanonicalCandidate = {
    name: provider.name,
    incumbent: true,
    candidateUrl: "https://example.org/office",
    biography: "A sourced biography",
    citations: ["incumbent", "candidateUrl", "biography"].map((field) => ({
      field,
      sourceName: "Supplementary source",
      tier: "vote_smart",
      official: false,
    })),
  };
  const result = retainCandidateProviderFields(provider, enrichment);
  assert.equal(result.incumbent ?? provider.incumbent, false);
  assert.equal(
    result.candidateUrl ?? provider.candidateUrl,
    provider.candidateUrl,
  );
  assert.equal(result.biography, enrichment.biography);
  assert.deepEqual(
    result.citations.map((c) => c.field),
    ["biography"],
  );
  assert.equal(
    enrichment.incumbent,
    true,
    "shared candidate cache stays intact",
  );
  assert.equal(enrichment.citations.length, 3);
});

void test("higher-tier or equal-tier fields win, and missing provider fields can be filled", () => {
  for (const tier of ["state_sos", "ballotpedia"] satisfies SourceTier[]) {
    const enrichment: CanonicalCandidate = {
      name: provider.name,
      incumbent: true,
      email: "synthetic@example.org",
      citations: ["incumbent", "email"].map((field) => ({
        field,
        sourceName: "Supplementary source",
        tier,
        official: tier === "state_sos",
      })),
    };
    assert.deepEqual(
      retainCandidateProviderFields(provider, enrichment),
      enrichment,
    );
  }
});
