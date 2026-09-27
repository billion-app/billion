import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

import type { VoterInfoResponse } from "@acme/api";

import { electionsTabModel } from "./elections-tab";

const ballot: VoterInfoResponse = {
  kind: "test",
  election: {
    id: "dw:selected",
    name: "General",
    electionDay: "2026-11-03",
    ocdDivisionId: "ocd-division/country:us/state:ca",
  },
  normalizedInput: {
    line1: "1 Test St",
    city: "Test",
    state: "CA",
    zip: "00000",
  },
  contests: [
    { type: "candidate", office: "Governor", candidates: [] },
    { type: "referendum", referendumTitle: "Proposition 42" },
  ],
};

void test("a failed query refresh retains cached data but the ballot view hides it", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["ballot"], ballot);
  const observer = new QueryObserver<VoterInfoResponse>(client, {
    queryKey: ["ballot"],
    queryFn: () => Promise.reject(new Error("provider unavailable")),
  });
  try {
    const result = await observer.refetch();
    assert.equal(result.isError, true);
    assert.deepEqual(result.data, ballot);
    assert.equal(electionsTabModel(result, false).data, undefined);
  } finally {
    client.clear();
  }
});

void test("editing, fetching and mismatched elections hide ballot content", () => {
  const ready = { data: ballot, isFetching: false, isError: false };
  assert.equal(electionsTabModel(ready, true).data, undefined);
  assert.equal(
    electionsTabModel({ ...ready, isFetching: true }, false).data,
    undefined,
  );
  const mismatch = electionsTabModel(ready, false, "dw:other");
  assert.equal(mismatch.data, undefined);
  assert.equal(mismatch.mismatch, true);
  assert.equal(electionsTabModel(ready, false, "dw:selected").data, ballot);
});

void test("provider-selected races survive when their candidate roster is unavailable", () => {
  const model = electionsTabModel(
    { data: ballot, isFetching: false, isError: false },
    false,
  );
  assert.equal(model.candidates.length, 1);
  assert.equal(model.candidates[0]?.office, "Governor");
  assert.equal(model.measures.length, 1);
});
