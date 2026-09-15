/* eslint-disable @typescript-eslint/require-await -- Async fakes match the injected provider/cache interfaces. */
import assert from "node:assert/strict";
import { test } from "node:test";

import type { VoterInfoResponse } from "./civic";
import { createVoterInfoLoader } from "./civic-voter-info";

const ballot: VoterInfoResponse = {
  kind: "fake",
  election: {
    id: "1",
    name: "Test",
    electionDay: "2026-11-03",
    ocdDivisionId: "test",
  },
  otherElections: [
    {
      id: "2",
      name: "Other",
      electionDay: "2026-11-03",
      ocdDivisionId: "test",
    },
  ],
  normalizedInput: {
    line1: "1 Test St",
    city: "Test",
    state: "CA",
    zip: "00000",
  },
  contests: [{ type: "test", office: "Test office" }],
};

void test("base and enriched caches stay independent and retain other elections", async () => {
  const cache = new Map<string, VoterInfoResponse>();
  let fetches = 0;
  let enrichments = 0;
  const load = createVoterInfoLoader({
    getCached: async (_, endpoint) => cache.get(endpoint) ?? null,
    setCache: async (_, endpoint, __, result) => {
      cache.set(endpoint, structuredClone(result));
    },
    fetch: async () => {
      fetches++;
      return structuredClone(ballot);
    },
    enrich: async (result) => {
      enrichments++;
      assert.ok(result.contests?.[0]);
      result.contests[0].summary = "Enriched";
    },
  });
  for (let i = 0; i < 2; i++) {
    const enriched = await load("a", "1");
    const base = await load("a", "1", { includeEnrichment: false });
    assert.equal(enriched.contests?.[0]?.summary, "Enriched");
    assert.equal(base.contests?.[0]?.summary, undefined);
    assert.deepEqual(base.otherElections, ballot.otherElections);
  }
  assert.equal(fetches, 2);
  assert.equal(enrichments, 1);
});

void test("unknown election retries once, failure writes no cache or enrichment", async () => {
  let fetches = 0;
  const load = createVoterInfoLoader({
    getCached: async () => null,
    setCache: async () => {
      assert.fail("must not cache failure");
    },
    enrich: async () => {
      assert.fail("must not enrich failure");
    },
    fetch: async (params) => {
      fetches++;
      assert.equal(params.electionId, fetches === 1 ? "bad" : undefined);
      throw new Error("Election unknown");
    },
  });
  await assert.rejects(load("a", "bad"), /Election unknown/);
  assert.equal(fetches, 2);
});

void test("successful fallback preserves returned election and caches only its identity", async () => {
  let calls = 0;
  let written: Record<string, unknown> | undefined;
  const load = createVoterInfoLoader({
    getCached: async () => null,
    setCache: async (_, __, params) => {
      written = params;
    },
    enrich: async () => {
      assert.fail("base-only must not enrich");
    },
    fetch: async (params) => {
      calls++;
      if (calls === 1) throw new Error("Election unknown");
      assert.equal(params.electionId, undefined);
      return structuredClone(ballot);
    },
  });
  const result = await load("a", "rejected", { includeEnrichment: false });
  assert.equal(result.election.id, "1");
  assert.deepEqual(written, { electionId: "1" });
  assert.equal(calls, 2);
});
