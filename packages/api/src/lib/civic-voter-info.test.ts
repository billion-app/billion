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
  const cache = new Map<string, VoterInfoResponse>([
    ["voterinfo", ballot],
    ["voterinfoBase", ballot],
  ]);
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

void test("provider failure is not retried, enriched or cached", async () => {
  let fetches = 0;
  const load = createVoterInfoLoader({
    getCached: async (_, endpoint) => {
      assert.ok(endpoint.startsWith("democracy-works:v2:1:"));
      return null;
    },
    setCache: async () => {
      assert.fail("must not cache failure");
    },
    enrich: async () => {
      assert.fail("must not enrich failure");
    },
    fetch: async () => {
      fetches++;
      throw new Error("provider unavailable");
    },
  });
  await assert.rejects(load("a", "dw:selected"), /provider unavailable/);
  assert.equal(fetches, 1);
});

void test("default cache rolls over with selection date while explicit election remains cached", async () => {
  let clock = new Date("2026-11-04T11:59:59Z");
  const cache = new Map<string, VoterInfoResponse>();
  let fetches = 0;
  const load = createVoterInfoLoader({
    now: () => clock,
    getCached: async (_, endpoint, params) =>
      cache.get(JSON.stringify([endpoint, params])) ?? null,
    setCache: async (_, endpoint, params, result) => {
      cache.set(JSON.stringify([endpoint, params]), result);
    },
    fetch: async () => {
      fetches++;
      return ballot;
    },
    enrich: async () => {
      return;
    },
  });
  await load("a");
  await load("a", "1");
  await load("a");
  assert.equal(fetches, 2);
  clock = new Date("2026-11-04T12:00:00Z");
  await load("a");
  await load("a", "1");
  assert.equal(fetches, 3);
});
