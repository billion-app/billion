import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type { ResearchSource } from "@acme/validators";

import { buildCaliforniaDossier } from "./california-dossier.js";
import { fixtureDossier } from "./california-dossier.test.js";
import {
  reusableFinanceQuerySources,
  seedFinanceQueryCache,
} from "./california-finance-source-cache.js";

const observed = "2026-10-30T00:00:00.000Z";
const now = "2026-10-30T01:00:00.000Z";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const query = (path = "reports/house-senate/", fetchedAt = observed) => {
  const candidate = path === "schedules/schedule_e/by_candidate/";
  const url = `https://api.open.fec.gov/v1/${path}?cycle=2026&${candidate ? "candidate_id=H0CA10073" : "committee_id=C00000001"}&per_page=100&page=1${candidate ? "" : "&most_recent=true"}`;
  const text = JSON.stringify({
    pagination: { is_count_exact: true, page: 1, pages: 1, count: 1 },
    results: [{ committee_id: "C00000001", file_number: 1 }],
  });
  return {
    id: `fec-${hash(url).slice(0, 20)}`,
    url,
    publisher: "Federal Election Commission",
    format: "json" as const,
    fetchedAt,
    text,
    contentHash: hash(text),
    byteHash: hash(text),
    retrievalUrls: [url],
  };
};
function fixture(sources: ResearchSource[] = [query()]) {
  const expected = buildCaliforniaDossier({
    ...fixtureDossier(),
    officeKind: "federal_legislative",
    officeFamily: "us_house",
  });
  const document = buildCaliforniaDossier({
    ...expected,
    sources: [...expected.sources, ...sources],
  });
  return { expected, document, digest: document.dossierDigest, now };
}

test("reuses full immutable query observations without changing metadata or fetching", async () => {
  const input = fixture([
    query(),
    query("schedules/schedule_e/by_candidate/"),
    query("filings/"),
  ]);
  const sources = reusableFinanceQuerySources(input);
  assert.equal(sources.length, 3);
  assert.deepEqual(sources, input.document.sources.slice(1));
  const shared = new Map<string, Promise<ResearchSource>>();
  seedFinanceQueryCache(sources, shared);
  for (const source of sources) {
    const cached = await shared.get(source.url);
    assert.equal(cached, source);
    assert.equal(cached.fetchedAt, observed);
    assert.deepEqual(cached.retrievalUrls, [source.url]);
  }
  assert.equal(
    shared.has(sources[0]!.url.replace("C00000001", "C00000002")),
    false,
  );
  const current = { ...sources[0]!, fetchedAt: now };
  shared.set(current.url, Promise.resolve(current));
  seedFinanceQueryCache(sources, shared);
  assert.equal(await shared.get(current.url), current);
});

test("rejects stale, future and derived query observations", () => {
  for (const source of [
    { ...query(), fetchedAt: "2026-10-29T13:00:00.000Z" },
    { ...query(), fetchedAt: "2026-10-30T02:00:00.000Z" },
    { ...query(), id: "H0CA10073:report:123" },
    { ...query(), publisher: "Unverified publisher" },
    { ...query(), format: "text" as const },
  ])
    assert.deepEqual(reusableFinanceQuerySources(fixture([source])), []);
  assert.deepEqual(
    reusableFinanceQuerySources({ ...fixture(), now: "not a date" }),
    [],
  );
});

test("rejects altered hash, truncated pagination, foreign origin and wrong dossier binding", () => {
  const input = fixture();
  assert.deepEqual(
    reusableFinanceQuerySources({ ...input, digest: "b".repeat(64) }),
    [],
  );
  for (const mutate of [
    (value: typeof input) => {
      value.expected.identity.candidateId = "other";
    },
    (value: typeof input) => {
      value.expected.rosterDigest = "b".repeat(64);
    },
    (value: typeof input) => {
      value.expected.identity.electionDate = "2028-11-07";
    },
    (value: typeof input) => {
      value.document.sources[1]!.contentHash = "b".repeat(64);
    },
  ]) {
    const value = fixture();
    mutate(value);
    assert.deepEqual(reusableFinanceQuerySources(value), []);
  }
  for (const patch of [
    {
      pagination: { is_count_exact: true, page: 1, pages: 2, count: 2 },
      results: [{}],
    },
    { committee_id: "C00000001", exact_count: 1, filings: [{}] },
  ]) {
    const source = query();
    source.text = JSON.stringify(patch);
    source.contentHash = hash(source.text);
    assert.deepEqual(reusableFinanceQuerySources(fixture([source])), []);
  }
  const source = query();
  source.url = source.url.replace("api.open.fec.gov", "example.org");
  source.id = `fec-${hash(source.url).slice(0, 20)}`;
  assert.deepEqual(reusableFinanceQuerySources(fixture([source])), []);
});

test("cache accepts only the current bounded canonical query contract", () => {
  for (const change of [
    (url: URL) => url.searchParams.set("cycle", "2024"),
    (url: URL) => url.searchParams.set("page", "2"),
    (url: URL) => url.searchParams.set("per_page", "200"),
    (url: URL) => url.searchParams.delete("committee_id"),
    (url: URL) => url.searchParams.set("most_recent", "false"),
    (url: URL) => url.searchParams.set("api_key", "not-for-cache"),
    (url: URL) => {
      url.pathname = "/v1/unreviewed/";
    },
  ]) {
    const source = query();
    const url = new URL(source.url);
    change(url);
    source.url = url.toString();
    source.id = `fec-${hash(source.url).slice(0, 20)}`;
    assert.deepEqual(reusableFinanceQuerySources(fixture([source])), []);
  }
});

test("a query used as nonfinancial evidence must still be fetched live", () => {
  const input = fixture();
  const source = input.document.sources[1]!;
  const document = buildCaliforniaDossier({
    ...input.document,
    evidence: [
      ...input.document.evidence,
      {
        id: "nonfinancial-record",
        sourceId: source.id,
        excerpt: source.text,
        locator: "Nonfinancial record",
        origin: "primary_record",
        role: "candidate_record",
        identityQualification: "exact_election_office",
      },
    ],
  });
  assert.deepEqual(
    reusableFinanceQuerySources({
      ...input,
      document,
      digest: document.dossierDigest,
    }),
    [],
  );
});
