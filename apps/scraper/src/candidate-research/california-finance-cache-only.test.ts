import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { inspect } from "node:util";

import { buildCaliforniaDossier } from "./california-dossier.js";
import { fixtureDossier } from "./california-dossier.test.js";
import { fetchBoundedCaliforniaSource } from "./california-evidence.js";
import {
  CaliforniaFinanceCacheOnly,
  CaliforniaFinanceCacheUnavailable,
} from "./california-finance-cache-only.js";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const observed = "2026-10-30T00:00:00.000Z";
const now = "2026-10-30T01:00:00.000Z";
function fixture() {
  const expected = buildCaliforniaDossier({
    ...fixtureDossier(),
    officeKind: "federal_legislative",
    officeFamily: "us_house",
  });
  const url =
    "https://api.open.fec.gov/v1/reports/house-senate/?cycle=2026&committee_id=C00000001&per_page=100&page=1&most_recent=true";
  const text = JSON.stringify({
    pagination: { is_count_exact: true, page: 1, pages: 1, count: 1 },
    results: [{ committee_id: "C00000001", file_number: 1 }],
  });
  const source = {
    id: `fec-${hash(url).slice(0, 20)}`,
    url,
    publisher: "Federal Election Commission",
    format: "json" as const,
    text,
    contentHash: hash(text),
    fetchedAt: observed,
  };
  const document = buildCaliforniaDossier({
    ...expected,
    sources: [...expected.sources, source],
  });
  return { expected, source, document, digest: document.dossierDigest };
}

test("cache-only retains exact source observations and records owner and lookup separately", () => {
  const input = fixture();
  const cache = new CaliforniaFinanceCacheOnly(() => now);
  cache.seed(input);
  const source = cache.read(input.source.url, "selected-opponent");
  assert.deepEqual(source, input.source);
  cache.complete("selected-opponent");
  cache.assertReady(["selected-opponent"]);
  const proof = cache.receipt();
  assert.equal(proof.apiCacheHits[0]!.fetchedAt, observed);
  assert.equal(proof.apiCacheHits[0]!.lookupAt, now);
  assert.deepEqual(proof.apiCacheHits[0]!.cacheOwners, [
    input.expected.identity.candidateId,
  ]);
  assert.equal(proof.apiTransportAttempts, 0);
  assert.equal(proof.nonApiTransportAttempts, 0);
  source.text = "caller mutation";
  assert.deepEqual(
    cache.read(input.source.url, "selected-opponent"),
    input.source,
  );
});

test("cache-only rejects absent, changed scope, derived, hash-invalid and expired source acquisitions", () => {
  const input = fixture();
  for (const source of [
    { ...input.source, id: "derived-report" },
    { ...input.source, contentHash: "0".repeat(64) },
    { ...input.source, fetchedAt: "2026-10-29T00:00:00.000Z" },
  ]) {
    const cache = new CaliforniaFinanceCacheOnly(() => now);
    const document = {
      ...input.document,
      sources: [...input.expected.sources, source],
    };
    cache.seed({ ...input, document });
    assert.throws(
      () => cache.read(input.source.url, "member"),
      CaliforniaFinanceCacheUnavailable,
    );
  }
  const cache = new CaliforniaFinanceCacheOnly(() => now);
  cache.seed(input);
  assert.throws(
    () =>
      cache.read(input.source.url.replace("C00000001", "C00000002"), "member"),
    /Exact raw query is absent/,
  );
  cache.read(input.source.url, "member");
  cache.complete("member");
  assert.throws(() => cache.assertReady(["member"]), /complete race/);
});

test("cache-only rechecks original age at acquisition and requires every member", () => {
  const input = fixture();
  let clock = now;
  const cache = new CaliforniaFinanceCacheOnly(() => clock);
  cache.seed(input);
  cache.read(input.source.url, "first");
  cache.complete("first");
  assert.throws(() => cache.assertReady(["first", "second"]), /complete race/);
  clock = "2026-10-30T12:00:00.000Z";
  assert.throws(() => cache.read(input.source.url, "second"), /expired/);
  assert.equal(cache.receipt().apiCacheHits[0]!.fetchedAt, observed);
});

for (const url of [
  "https://api.open.fec.gov/v1/reports/house-senate/",
  "https://API.OPEN.FEC.GOV./v1/filings/",
  "https://api.data.gov/agency/fec",
  "https://alias.api.open.fec.gov/v1/",
])
  test(`cache-only denies initial API URL before DNS or transport: ${url}`, async () => {
    const cache = new CaliforniaFinanceCacheOnly(() => now);
    let dns = 0,
      transports = 0;
    await assert.rejects(
      fetchBoundedCaliforniaSource(
        "test",
        url,
        "FEC",
        "json",
        { request() {}, bytes() {} },
        undefined,
        {
          financeCacheOnly: cache,
          addresses: async () => {
            dns++;
            return [];
          },
          transport: async () => {
            transports++;
            return new Response("{}");
          },
        },
      ),
      CaliforniaFinanceCacheUnavailable,
    );
    assert.equal(dns, 0);
    assert.equal(transports, 0);
    assert.equal(cache.receipt().deniedApiRequests.length, 1);
  });

test("cache-only denies API redirect before its DNS and transport and retains denial", async () => {
  const cache = new CaliforniaFinanceCacheOnly(() => now);
  const dns: string[] = [],
    transport: string[] = [];
  await assert.rejects(
    fetchBoundedCaliforniaSource(
      "test",
      "https://www.fec.gov/data/",
      "FEC",
      "html",
      { request() {}, bytes() {} },
      undefined,
      {
        financeCacheOnly: cache,
        addresses: async (url) => {
          dns.push(url);
          return [];
        },
        transport: async (url) => {
          transport.push(url);
          return new Response(null, {
            status: 302,
            headers: { Location: "https://api.data.gov/fec/v1/filings/" },
          });
        },
      },
    ),
    CaliforniaFinanceCacheUnavailable,
  );
  assert.deepEqual(dns, ["https://www.fec.gov/data/"]);
  assert.deepEqual(transport, dns);
  assert.equal(cache.receipt().nonApiTransportAttempts, 1);
  assert.equal(cache.receipt().apiTransportAttempts, 0);
  assert.equal(cache.receipt().deniedApiRequests[0]!.stage, "redirect");
});

for (const action of ["deny", "miss"] as const)
  test(`cache-only ${action} diagnostics omit query, userinfo and fragment secrets`, () => {
    const cache = new CaliforniaFinanceCacheOnly(() => now);
    const secret = "SYNTHETIC_CREDENTIAL_SENTINEL";
    const url = `https://${secret}:${secret}@api.open.fec.gov/v1/filings/?api_key=${secret}&token=${secret}#${secret}`;
    let failure: Error | undefined;
    try {
      if (action === "deny") cache.beforeDns(url);
      else cache.read(url, "member");
    } catch (error) {
      assert(error instanceof CaliforniaFinanceCacheUnavailable);
      failure = error;
    }
    assert(failure);
    assert.equal(inspect(failure, { depth: 5 }).includes(secret), false);
    const retained = cache.receipt();
    const diagnostic =
      action === "deny"
        ? retained.deniedApiRequests[0]!
        : retained.cacheMisses[0]!;
    assert.equal(diagnostic.url, "https://api.open.fec.gov/v1/filings/");
    assert.equal(
      JSON.stringify({
        receipt: retained,
        error: {
          message: failure.message,
          stack: failure.stack,
          cause: failure.cause,
        },
      }).includes(secret),
      false,
    );
  });

test("credential-bearing API redirect diagnostics stay safe after failure serialization", async () => {
  const cache = new CaliforniaFinanceCacheOnly(() => now);
  const secret = "SYNTHETIC_CREDENTIAL_SENTINEL";
  let dns = 0,
    transports = 0;
  let failure: Error | undefined;
  try {
    await fetchBoundedCaliforniaSource(
      "test",
      "https://www.fec.gov/data/",
      "FEC",
      "html",
      { request() {}, bytes() {} },
      undefined,
      {
        financeCacheOnly: cache,
        addresses: async () => {
          dns++;
          return [];
        },
        transport: async () => {
          transports++;
          return new Response(null, {
            status: 302,
            headers: {
              Location: `https://api.open.fec.gov/v1/filings/?api_key=${secret}&token=${secret}`,
            },
          });
        },
      },
    );
  } catch (error) {
    assert(error instanceof CaliforniaFinanceCacheUnavailable);
    failure = error;
  }
  assert(failure);
  assert.equal(inspect(failure, { depth: 5 }).includes(secret), false);
  assert.equal(dns, 1);
  assert.equal(transports, 1);
  const receipt = cache.receipt();
  const checkpoint = {
    acquisitionMode: receipt.acquisitionMode,
    financeCacheAcquisition: receipt,
    reason: failure.message,
  };
  const cli = {
    financeCacheAcquisition: receipt,
    outcomes: [{ status: "blocked", reason: failure.message }],
  };
  assert.equal(
    JSON.stringify({
      checkpoint,
      cli,
      stack: failure.stack,
      cause: failure.cause,
    }).includes(secret),
    false,
  );
  assert.equal(
    receipt.deniedApiRequests[0]!.url,
    "https://api.open.fec.gov/v1/filings/",
  );
  assert.equal(receipt.apiTransportAttempts, 0);
});

function anotherObservation(fetchedAt: string) {
  const input = fixture();
  const expected = buildCaliforniaDossier({
    ...input.expected,
    identity: {
      ...input.expected.identity,
      candidateId: input.expected.identity.candidateId.replace(/:1$/, ":2"),
    },
  });
  const source = { ...input.source, fetchedAt };
  const document = buildCaliforniaDossier({
    ...expected,
    sources: [...expected.sources, source],
  });
  return { expected, source, document, digest: document.dossierDigest };
}

for (const reversed of [false, true])
  test(`same query observations retain the oldest exact object independent of seed order (${reversed})`, () => {
    const older = fixture();
    const newer = anotherObservation("2026-10-30T00:10:00.000Z");
    const cache = new CaliforniaFinanceCacheOnly(() => now);
    for (const input of reversed ? [newer, older] : [older, newer])
      cache.seed(input);
    for (const owner of [
      older.expected.identity.candidateId,
      newer.expected.identity.candidateId,
    ])
      assert.deepEqual(cache.read(older.source.url, owner), older.source);
    assert(
      cache
        .receipt()
        .apiCacheHits.every((hit) => hit.fetchedAt === older.source.fetchedAt),
    );
    assert(
      cache
        .receipt()
        .apiCacheHits.every(
          (hit) =>
            JSON.stringify(hit.cacheOwners) ===
            JSON.stringify([older.expected.identity.candidateId]),
        ),
    );
  });

test("owners merge only for the complete selected observation and its age is never extended", () => {
  const older = fixture();
  const same = anotherObservation(observed);
  const newer = anotherObservation("2026-10-30T00:10:00.000Z");
  let clock = now;
  const cache = new CaliforniaFinanceCacheOnly(() => clock);
  cache.seed(newer);
  cache.seed(older);
  cache.seed(same);
  assert.deepEqual(cache.read(older.source.url, "reader"), older.source);
  assert.deepEqual(
    cache.receipt().apiCacheHits[0]!.cacheOwners,
    [
      older.expected.identity.candidateId,
      same.expected.identity.candidateId,
    ].sort(),
  );
  clock = "2026-10-30T12:00:00.000Z";
  assert.throws(() => cache.read(older.source.url, "reader"), /expired/);
  assert.equal(cache.receipt().apiCacheHits[0]!.fetchedAt, observed);
});

test("different raw query bodies or other metadata remain conflicting observations", () => {
  const older = fixture();
  const input = anotherObservation("2026-10-30T00:10:00.000Z");
  const changedText = JSON.stringify({
    pagination: { is_count_exact: true, page: 1, pages: 1, count: 1 },
    results: [{ committee_id: "C00000001", file_number: 2 }],
  });
  for (const source of [
    { ...input.source, text: changedText, contentHash: hash(changedText) },
    { ...input.source, byteHash: "1".repeat(64) },
    {
      ...input.source,
      retrievalUrls: [input.source.url, "https://www.fec.gov/"],
    },
  ]) {
    const document = buildCaliforniaDossier({
      ...input.expected,
      sources: [...input.expected.sources, source],
    });
    const cache = new CaliforniaFinanceCacheOnly(() => now);
    cache.seed(older);
    assert.throws(
      () => cache.seed({ ...input, document, digest: document.dossierDigest }),
      /Conflicting raw query observations/,
    );
  }
});
