import assert from "node:assert/strict";
import test from "node:test";

import type { ResearchEvidence } from "./evidence-attribution";
import { researchEvidenceAttribution } from "./evidence-attribution";

function evidence(overrides: Partial<ResearchEvidence> = {}): ResearchEvidence {
  return {
    id: "campaign-source",
    title: "School forum",
    publisher: "Example campaign",
    url: "https://example.org/forum",
    locator: "Selected paragraph",
    retrievedAt: "2026-10-30T12:00:00Z",
    documentDate: null,
    contentHash: "0".repeat(64),
    excerpt: "The library needs support.",
    origin: "candidate",
    ...overrides,
  };
}

void test("campaign publication keeps mixed speaker context without assigning it to the candidate", () => {
  const context = {
    excerpt:
      "Statement by Principal Garcia\nThe library needs support.\nParent response\nKeep the reading room open.",
    locator: "School forum, speaker headings and responses",
  };
  const source = evidence({ attribution: { status: "unresolved", context } });
  const attribution = researchEvidenceAttribution(source);
  assert.equal(attribution.label, "Campaign publication");
  assert.equal(attribution.unresolved, true);
  assert.deepEqual(attribution.context, context);
  assert.equal(source.excerpt, "The library needs support.");
});

void test("official submission is a candidate statement even when the election office publishes it", () => {
  const attribution = researchEvidenceAttribution(
    evidence({
      publisher: "California Secretary of State",
      attribution: {
        status: "official_candidate_statement",
        context: {
          excerpt: "Candidate statement\nThe library needs support.",
          locator: "Candidate statements, page 12",
        },
      },
    }),
  );
  assert.equal(attribution.label, "Candidate statement");
  assert.equal(attribution.unresolved, false);
});

void test("sealed legacy material without attribution stays neutral", () => {
  const attribution = researchEvidenceAttribution(evidence());
  assert.equal(attribution.label, "Candidate-related material");
  assert.equal(attribution.unresolved, false);
  assert.equal(attribution.context, undefined);
});

void test("a candidate quotation does not turn a record or report into a candidate statement", () => {
  for (const origin of ["primary_record", "reporting"] as const) {
    const attribution = researchEvidenceAttribution(
      evidence({
        origin,
        excerpt: "Candidate Example said: The library needs support.",
      }),
    );
    assert.equal(
      attribution.label,
      origin === "primary_record" ? "Original record" : "Reporting",
    );
    assert.equal(attribution.unresolved, false);
  }
});
