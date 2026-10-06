import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { propositionContextSchema } from "@acme/validators";

import { officialGuidePayloadSchema } from "./official-guide-cache";
import {
  contextContentHash,
  publicPropositionContext,
  publishedPropositionContext,
  validateContextEvidence,
} from "./proposition-context";

const evidence = new URL("../../../../docs/evidence/444/", import.meta.url);
const guide = officialGuidePayloadSchema.parse(
  JSON.parse(readFileSync(new URL("guide.json", evidence), "utf8")),
);
function draft(number: string) {
  return propositionContextSchema.parse(
    JSON.parse(
      readFileSync(new URL(`prop${number}-context.json`, evidence), "utf8"),
    ),
  );
}
function approved(number: string) {
  const value = draft(number);
  return {
    ...value,
    review: {
      state: "approved" as const,
      reviewer: "Synthetic test editor",
      reviewedAt: "2026-10-06T00:00:00Z",
      revision: value.revision,
      contentHash: contextContentHash(value),
      findings: "Test approval only, never in the production registry",
    },
  };
}
void test("three real-source pilots use one gate; pending records never publish", () => {
  for (const number of ["2", "3", "39"]) {
    const measure = guide.measures.find((item) => item.number === number);
    assert.ok(measure);
    assert.ok(validateContextEvidence(draft(number)));
    assert.equal(
      publishedPropositionContext(guide.electionDate, measure, [draft(number)]),
      null,
    );
    assert.equal(
      publishedPropositionContext(guide.electionDate, measure),
      null,
    );
    const published = publishedPropositionContext(
      guide.electionDate,
      measure,
      [approved(number)],
      draft(number).sources,
    );
    assert.ok(published);
    assert.equal(published.number, number);
    assert.ok(published.sources.every((source) => !("snapshot" in source)));
  }
});
void test("title, legal URL, election, source, citation and explanation changes invalidate approval", () => {
  const measure = guide.measures.find((item) => item.number === "39");
  assert.ok(measure);
  const value = approved("39");
  for (const change of [
    { title: "Changed title" },
    { fullTextUrl: "https://example.org/changed.pdf" },
    { officialSummary: "Changed" },
    { sourceUrl: "https://example.org/guide" },
    { number: "3" },
  ])
    assert.equal(
      publishedPropositionContext(
        guide.electionDate,
        { ...measure, ...change },
        [value],
        value.sources,
      ),
      null,
    );
  assert.equal(
    publishedPropositionContext("2028-11-07", measure, [value], value.sources),
    null,
  );
  for (const change of [
    { takeaway: { ...value.takeaway, text: "Edited after review" } },
    {
      sources: value.sources.map((source) => ({
        ...source,
        snapshot: "Changed evidence",
      })),
    },
    { sources: [...value.sources, value.sources[0]] },
    { review: { ...value.review, revision: "another-revision" } },
    { review: { ...value.review, reviewedAt: "2025-01-01T00:00:00Z" } },
    {
      chain: [
        {
          actor: "Unknown",
          action: {
            ...value.today,
            evidence: [{ sourceId: "missing", locator: "none" }],
          },
        },
      ],
    },
  ])
    assert.equal(
      publishedPropositionContext(
        guide.electionDate,
        measure,
        [{ ...value, ...change }],
        value.sources,
      ),
      null,
    );
});
void test("broken references or missing legal evidence cannot pass by recomputing the review digest", () => {
  const measure = guide.measures[0];
  assert.ok(measure);
  for (const change of [
    {
      sources: draft("2").sources.filter(
        (source) => source.layer !== "legal-text",
      ),
    },
    {
      takeaway: {
        ...draft("2").takeaway,
        evidence: [{ sourceId: "absent", locator: "Missing source" }],
      },
    },
  ]) {
    const value = { ...approved("2"), ...change };
    value.review.contentHash = contextContentHash(value);
    assert.equal(
      publishedPropositionContext(
        guide.electionDate,
        measure,
        [value],
        value.sources,
      ),
      null,
    );
  }
});

void test("adopting changed or missing supplemental evidence withholds the old explanation", () => {
  const measure = guide.measures.find((item) => item.number === "39");
  assert.ok(measure);
  const value = approved("39");
  assert.ok(
    publishedPropositionContext(
      guide.electionDate,
      measure,
      [value],
      value.sources,
    ),
  );
  for (const sources of [
    [],
    value.sources.filter((source) => source.id !== "law"),
    value.sources.map((source) =>
      source.id === "history"
        ? { ...source, snapshot: "New historical evidence" }
        : source,
    ),
  ])
    assert.equal(
      publishedPropositionContext(
        guide.electionDate,
        measure,
        [value],
        sources,
      ),
      null,
    );
});

void test("old and new captures for the same key are rejected in either order", () => {
  const measure = guide.measures.find((item) => item.number === "39");
  assert.ok(measure);
  const value = approved("39");
  const old = value.sources.find((source) => source.id === "history");
  assert.ok(old);
  const newer = { ...old, snapshot: "Newly adopted historical evidence" };
  for (const captures of [
    [...value.sources, newer],
    [newer, ...value.sources],
  ])
    assert.equal(
      publishedPropositionContext(
        guide.electionDate,
        measure,
        [value],
        captures,
      ),
      null,
    );
});
void test("development preview records are exactly the public projections of captured drafts", () => {
  const raw: unknown = JSON.parse(
    readFileSync(
      new URL(
        "../../../../apps/expo/src/components/ballot-evidence/development/context-pilots.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.deepEqual(
    raw,
    ["3", "39", "2"].map((number) => publicPropositionContext(draft(number))),
  );
});

void test("every money-bearing claim requires context, including scenarios and historical outcomes", () => {
  const value = draft("2");
  const scenario = value.scenarios[0];
  assert.ok(scenario);
  scenario.claim.text =
    "Assume $100 billion taxes, $10 billion reserve and $0.75 billion deposit.";
  assert.equal(
    propositionContextSchema.safeParse({
      ...value,
      scenarios: [
        { ...scenario, claim: { ...scenario.claim, money: undefined } },
      ],
    }).success,
    false,
  );
  assert.equal(
    propositionContextSchema.safeParse({
      ...value,
      scenarios: [
        {
          ...scenario,
          claim: {
            ...scenario.claim,
            money: scenario.claim.money?.slice(0, 1),
          },
        },
      ],
    }).success,
    false,
  );
  const history = draft("39");
  const outcome = history.history[2];
  assert.ok(outcome);
  outcome.followThrough.text =
    "The follow-up reported $45 million annual additional revenue.";
  assert.equal(
    propositionContextSchema.safeParse({
      ...history,
      history: [
        {
          ...outcome,
          followThrough: { ...outcome.followThrough, money: undefined },
        },
      ],
    }).success,
    false,
  );
});

void test("budget denominator evidence participates in publication and review invalidation", () => {
  const value = approved("2");
  const amount = value.scenarios[0]?.claim.money?.[0];
  assert.ok(amount?.comparison.state === "available");
  amount.comparison.denominator.evidence = [
    { sourceId: "absent-budget", locator: "Unknown budget" },
  ];
  value.review.contentHash = contextContentHash(value);
  assert.equal(validateContextEvidence(value), false);
  const measure = guide.measures.find((item) => item.number === "2");
  assert.ok(measure);
  assert.equal(
    publishedPropositionContext(
      guide.electionDate,
      measure,
      [value],
      value.sources,
    ),
    null,
  );
  const changed = approved("2");
  const originalHash = changed.review.contentHash;
  const money = changed.scenarios[0]?.claim.money?.[0];
  assert.ok(money?.comparison.state === "available");
  money.comparison.denominator.amount *= 2;
  assert.notEqual(contextContentHash(changed), originalHash);
  assert.equal(
    publishedPropositionContext(
      guide.electionDate,
      measure,
      [changed],
      changed.sources,
    ),
    null,
  );
});

void test("money coverage requires complete mentions, not dollar or amount prefixes", () => {
  const value = draft("3");
  const money = value.magnitude[0]?.amount.money?.[0];
  assert.ok(money);
  for (const nominal of ["$", "$5", "$50"]) {
    assert.equal(
      propositionContextSchema.safeParse({
        ...value,
        today: {
          ...value.today,
          text: "Costs $5 billion and $50 billion",
          money: [{ ...money, nominal }],
        },
      }).success,
      false,
    );
  }
});

void test("headings, actor labels and evidence locators cannot hide unpaired amounts", () => {
  const value = draft("3");
  for (const change of [
    { mechanismQuestion: "What happens to $5 billion?" },
    { terms: [{ term: "$5 billion", meaning: value.today }] },
    {
      chain: [
        { actor: "$5 billion agency", action: value.today },
        value.chain[1],
      ],
    },
    { scenarios: [{ title: "$5 billion example", claim: value.today }] },
    {
      questions: [{ question: "Where does $5 billion go?", path: value.today }],
    },
    {
      today: {
        ...value.today,
        evidence: [{ sourceId: "law", locator: "$5–15bn ÷ $250bn" }],
      },
    },
  ])
    assert.equal(
      propositionContextSchema.safeParse({ ...value, ...change }).success,
      false,
    );
});
