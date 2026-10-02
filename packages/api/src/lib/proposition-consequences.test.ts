import assert from "node:assert/strict";
import test from "node:test";

import {
  propositionGuideHash,
  propositionGuideSnapshot,
  publicPropositionConsequences,
  publishedPropositionConsequences,
} from "./proposition-consequences";

const date = "2026-11-03";
const measure = {
  number: "5",
  title: "Official title",
  sourceUrl: "https://voterguide.sos.ca.gov/propositions/5/",
  officialSummary: "Summary",
  voteMeaningYes: "Changes the rule",
  voteMeaningNo: "Retains the rule",
  fiscalImpact: "Net fiscal effect is unknown.",
};
const claim = (text: string) => ({ text, sourceIds: ["guide"] });
function revision() {
  const hash = propositionGuideHash(date, measure);
  return {
    schemaVersion: 1,
    revision: "prop-5-v1",
    electionDate: date,
    number: "5",
    officialTitle: measure.title,
    officialUrl: measure.sourceUrl,
    guideHash: hash,
    templateVersion: "consequences-v1",
    generatedAt: "2026-10-01T00:00:00Z",
    model: "test-fixture",
    sources: [
      {
        id: "guide",
        name: "Official guide",
        url: measure.sourceUrl,
        retrievedAt: "2026-10-01T00:00:00Z",
        snapshot: propositionGuideSnapshot(date, measure),
      },
    ],
    headline: claim("Change the rule"),
    currentRule: claim("Current rule"),
    yes: claim("Changes the rule if the condition occurs"),
    no: claim("Retains the rule"),
    implementation: [claim("The institution implements the change")],
    affected: [claim("Affected institution")],
    costsAndFunding: claim("Net fiscal effect is unknown"),
    uncertainty: claim("The effect depends on a future condition"),
    review: {
      state: "approved",
      reviewer: "Fixture editor",
      reviewedAt: "2026-10-02T00:00:00Z",
      revision: "prop-5-v1",
      guideHash: hash,
      findings: "Synthetic review only",
    },
  };
}
void test("only approved matching revisions publish; internal snapshots are stripped", () => {
  const approved = publishedPropositionConsequences(date, measure, [
    revision(),
  ]);
  assert.ok(approved);
  assert.equal(
    publicPropositionConsequences(approved)?.sources[0]?.name,
    "Official guide",
  );
  const publicSource = publicPropositionConsequences(approved)?.sources[0];
  assert.ok(publicSource);
  assert.ok(!("snapshot" in publicSource));
  assert.equal(publishedPropositionConsequences(date, measure), null);
  for (const state of ["pending", "rejected"])
    assert.equal(
      publishedPropositionConsequences(date, measure, [
        { ...revision(), review: { state } },
      ]),
      null,
    );
});
void test("source changes, identity changes and missing fiscal evidence invalidate approval", () => {
  for (const changed of [
    { title: "New title" },
    { sourceUrl: "https://voterguide.sos.ca.gov/propositions/1/" },
    { number: "1" },
    { fiscalImpact: "New estimate" },
    { fiscalImpact: undefined },
    { officialSummary: "Changed summary" },
    { voteMeaningNo: "Changed outcome" },
  ]) {
    assert.equal(
      publishedPropositionConsequences(date, { ...measure, ...changed }, [
        revision(),
      ]),
      null,
    );
  }
  assert.equal(
    publishedPropositionConsequences("2028-11-07", measure, [revision()]),
    null,
  );
});
void test("broken citations, mismatched review revision, duplicate sources and pre-generation approval are rejected", () => {
  const draft = revision();
  for (const changed of [
    { yes: { text: "Unsupported", sourceIds: ["missing"] } },
    { sources: [...draft.sources, ...draft.sources] },
    { review: { ...draft.review, revision: "old" } },
    { review: { ...draft.review, reviewedAt: "2025-01-01T00:00:00Z" } },
  ])
    assert.equal(
      publishedPropositionConsequences(date, measure, [
        { ...draft, ...changed },
      ]),
      null,
    );
});
void test("substantively different bond measure can preserve conditional funding and unknown costs", () => {
  const bond = {
    ...measure,
    number: "1",
    title: "Bond authorization",
    voteMeaningYes: "Allows bonds",
    voteMeaningNo: "Does not authorize bonds",
  };
  const hash = propositionGuideHash(date, bond);
  const draft = {
    ...revision(),
    number: "1",
    officialTitle: bond.title,
    guideHash: hash,
    sources: [
      {
        ...revision().sources[0],
        snapshot: propositionGuideSnapshot(date, bond),
      },
    ],
    yes: claim("Authorizes borrowing; projects depend on later allocation"),
    no: claim("Does not authorize this borrowing"),
    costsAndFunding: claim(
      "Debt service depends on bond sales; net fiscal effect is unknown",
    ),
    review: { ...revision().review, guideHash: hash },
  };
  assert.ok(publishedPropositionConsequences(date, bond, [draft]));
});

void test("captured guide snapshot must match and rollback cannot bypass a changed source", () => {
  const draft = revision();
  assert.equal(
    publishedPropositionConsequences(date, measure, [
      {
        ...draft,
        sources: [{ ...draft.sources[0], snapshot: "Unrelated source text" }],
      },
    ]),
    null,
  );
  const older = {
    ...draft,
    revision: "older",
    review: { ...draft.review, revision: "older" },
  };
  assert.equal(
    publishedPropositionConsequences(date, measure, [older, draft])?.revision,
    "older",
  );
  assert.equal(
    publishedPropositionConsequences(
      date,
      { ...measure, fiscalImpact: "Changed" },
      [older, draft],
    ),
    null,
  );
});
