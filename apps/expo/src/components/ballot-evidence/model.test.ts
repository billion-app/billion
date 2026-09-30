import assert from "node:assert/strict";
import test from "node:test";

import {
  ballotStatus,
  citationFieldLabel,
  verificationLabel,
  verifiedLanguages,
  webUrl,
} from "./model";

void test("lookup evidence remains distinct without inferring publication or completeness", () => {
  const states = [
    ballotStatus({ kind: "invalid-input" }),
    ballotStatus({ kind: "provider-failure" }),
    ballotStatus({ kind: "result", electionKnown: true, contestCount: 0 }),
    ballotStatus({ kind: "result", electionKnown: false, contestCount: 0 }),
    ballotStatus({ kind: "result", electionKnown: true, contestCount: 2 }),
  ] as const;
  assert.equal(new Set(states.map((state) => state.title)).size, 5);
  assert.match(states[2].detail, /Billion has no contest information/);
  assert.doesNotMatch(
    states[2].detail,
    /not (yet )?published|not available yet/i,
  );
  assert.match(states[3].detail, /does not mean/);
  assert.match(states[4].detail, /Confirm your complete ballot/);
});

void test("retrieval alone never becomes human verification", () => {
  const citation = {
    field: "summary",
    sourceName: "Office",
    fetchedAt: "2026-09-14",
  };
  assert.equal(verificationLabel(citation), "Verification date unavailable");
  assert.equal(
    verificationLabel({
      ...citation,
      verifiedAt: "bad",
      verifiedBy: "Reviewer",
    }),
    "Verification date unavailable",
  );
  assert.match(
    verificationLabel({
      ...citation,
      verifiedAt: "2026-09-14",
      verifiedBy: "Reviewer",
    }),
    /Last verified/,
  );
});

void test("verified languages require an official material link and human verification", () => {
  const item = {
    language: "Spanish",
    material: "Voter guide",
    citation: {
      field: "languageServices",
      sourceName: "Election office",
      sourceUrl: "https://example.gov/guide",
      official: true,
      verifiedAt: "2026-09-14",
      verifiedBy: "Reviewer",
    },
  };
  assert.deepEqual(verifiedLanguages([]), []);
  assert.equal(verifiedLanguages([item]).length, 1);
  for (const change of [
    { official: false },
    { verifiedAt: undefined },
    { verifiedBy: undefined },
    { sourceUrl: undefined },
    { sourceUrl: "javascript:alert(1)" },
  ]) {
    assert.equal(
      verifiedLanguages([
        { ...item, citation: { ...item.citation, ...change } },
      ]).length,
      0,
    );
  }
});

void test("external links reject invalid and executable schemes", () => {
  for (const url of [
    undefined,
    "",
    "not a URL",
    "javascript:alert(1)",
    "file:///tmp/a",
    "https://user:pass@example.com",
  ])
    assert.equal(webUrl(url), undefined);
  assert.equal(
    webUrl("https://example.gov/guide"),
    "https://example.gov/guide",
  );
});

void test("readable field labels preserve candidate attribution punctuation", () => {
  assert.equal(
    citationFieldLabel("Alexandra Example-Sullivan · statementSummary"),
    "Alexandra Example-Sullivan · Statement summary",
  );
});
