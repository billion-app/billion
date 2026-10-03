import assert from "node:assert/strict";
import test from "node:test";

import { createTRPCRouter } from "../trpc";
import { candidateBriefsRouter } from "./candidate-briefs";

void test("public read remains closed and does not touch the database", async () => {
  const router = createTRPCRouter(candidateBriefsRouter);
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
  assert.equal(result.status, "policy_pending");
  assert.equal(result.brief, null);
  assert.equal(result.coverage.rosterCandidates, null);
  assert.equal(result.coverage.completeRace, false);
});
