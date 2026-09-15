import assert from "node:assert/strict";
import test from "node:test";

import { measure, summarize } from "./coverage.mjs";

test("missing fields and election identity remain distinct", () => {
  assert.equal(summarize({}).state, "no_data_found");
  assert.equal(
    summarize({ election: { id: "12" } }).state,
    "election_known_ballot_unavailable",
  );
  assert.equal(
    summarize({ election: { id: "12" }, contests: [{}] }).state,
    "data_available",
  );
  assert.equal(
    summarize({ election: { id: "12" } }, "13").state,
    "provider_error",
  );
  assert.equal(summarize({}).availability.contests.present, false);
  assert.equal(summarize({ contests: [] }).availability.contests.present, true);
});
test("otherElections requires an explicit choice without assuming the national election", () => {
  const body = {
    election: { id: "12" },
    otherElections: [{ id: "13" }],
    contests: [{}],
  };
  assert.equal(summarize(body).state, "election_selection_required");
  assert.equal(summarize(body, "12").state, "data_available");
});
const sample = {
  id: "ca-01",
  state: "CA",
  address: "private test address",
  electionId: "12",
};
test("bounded read-only request preserves selected ID and excludes secrets and address", async () => {
  let calls = 0;
  const result = await measure([sample], {
    key: "secret-test-key",
    fetcher: async (url) => {
      calls++;
      assert.equal(url.hostname, "www.googleapis.com");
      assert.equal(url.searchParams.get("electionId"), "12");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          election: { id: "12" },
          contests: [{}],
          normalizedInput: { line1: sample.address },
        }),
      };
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.rows[0].state, "data_available");
  assert.ok(!JSON.stringify(result).includes(sample.address));
  assert.ok(!JSON.stringify(result).includes("secret-test-key"));
});
test("credentials, transport errors and HTTP errors never become absence", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    throw new Error("secret");
  };
  assert.equal(
    (await measure([sample], { fetcher })).rows[0].state,
    "not_measured",
  );
  assert.equal(calls, 0);
  assert.equal(
    (await measure([sample], { key: "x", fetcher })).rows[0].state,
    "provider_error",
  );
  for (const status of [400, 403, 404, 429, 500]) {
    const result = await measure([sample], {
      key: "x",
      fetcher: async () => ({ ok: false, status }),
    });
    assert.equal(result.rows[0].state, "provider_error");
  }
  await assert.rejects(measure(Array(31).fill(sample)), /1–30/);
});
