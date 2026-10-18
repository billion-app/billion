import assert from "node:assert/strict";
import test from "node:test";

import { createTRPCRouter } from "../trpc";
import { createCandidateBriefsRouter } from "./candidate-briefs";

void test("public read remains closed and does not touch the database", async () => {
  const router = createTRPCRouter(
    createCandidateBriefsRouter({ approved: false, version: "pending" }),
  );
  const caller = router.createCaller({
    db: new Proxy(
      {},
      {
        get() {
          throw new Error("Database read is forbidden while policy is pending");
        },
      },
    ),
    session: null,
    authApi: {},
  } as never);
  const result = await caller.get({
    candidateId: "candidate",
    contestId: "race",
    jurisdiction: "fixture",
    electionDate: "2026-11-03",
  });
  assert.deepEqual(await caller.listRaces(), []);
  assert.equal(
    await caller.race({ releaseId: "00000000-0000-4000-8000-000000000443" }),
    null,
  );
  assert.equal(result.status, "policy_pending");
  assert.equal(result.brief, null);
  assert.equal(result.coverage.rosterCandidates, null);
  assert.equal(result.coverage.completeRace, false);
});

void test("production policy is resolved inside the release transaction snapshot", async () => {
  const transaction = {
    select() {
      throw new Error("No release reads while policy is pending");
    },
  };
  let resolved = false;
  const database = {
    transaction: async (
      run: (tx: unknown) => Promise<unknown>,
      options: unknown,
    ) => {
      assert.deepEqual(options, {
        isolationLevel: "repeatable read",
        accessMode: "read only",
      });
      return run(transaction);
    },
  };
  const router = createTRPCRouter(
    createCandidateBriefsRouter((db) => {
      assert.equal(db, transaction);
      resolved = true;
      return Promise.resolve({ approved: false, version: "pending" });
    }),
  );
  const caller = router.createCaller({
    db: database,
    session: null,
    authApi: {},
  } as never);
  assert.deepEqual(await caller.listRaces(), []);
  assert.equal(resolved, true);
});
