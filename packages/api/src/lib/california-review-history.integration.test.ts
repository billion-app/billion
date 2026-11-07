import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { eq, sql } from "@acme/db";
import {
  CaliforniaRaceWork,
  CaliforniaResearchArtifact,
  CaliforniaRoster,
} from "@acme/db/schema";

import {
  assertCaliforniaSemanticReviewClear,
  evaluateCaliforniaSemanticReview,
} from "./california-review-history";
import { candidateReviewHistoryFixture } from "./california-review-history.fixture";
import {
  claimCaliforniaModelDispatch,
  readCaliforniaModelHistory,
  saveCaliforniaResearchArtifact,
} from "./california-roster-store";

const url = process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  assert.equal(parsed.hostname, "127.0.0.1");
  assert.ok(parsed.pathname.endsWith("_test"));
  process.env.POSTGRES_URL = url;
}
void test(
  "atomic two-worker admission fences unknown dispatch, stale lease and genuine late rejected outcome through publication",
  { skip: !url },
  async () => {
    const { db } = await import("@acme/db/client");
    const f = candidateReviewHistoryFixture();
    const snapshotId = randomUUID(),
      workKey = `work:${f.scope.raceKey}`,
      owner = randomUUID();
    const workLease = { key: workKey, owner, generation: 1, reviewEpoch: 0 };
    try {
      await db.insert(CaliforniaRoster).values({
        id: snapshotId,
        electionDate: f.scope.identity.electionDate,
        document: {
          races: [
            {
              raceKey: f.scope.raceKey,
              members: [
                {
                  candidateId: f.scope.candidateId,
                  identity: f.scope.identity,
                },
              ],
            },
          ],
        },
      });
      await db.insert(CaliforniaRaceWork).values({
        key: workKey,
        snapshotId,
        raceKey: f.scope.raceKey,
        rosterDigest: "a".repeat(64),
        policyVersion: f.scope.policyVersion,
        researchVersion: "fixture",
        owner,
        generation: 1,
        reviewEpoch: 0,
        status: "running",
        leaseUntil: new Date(Date.now() + 60_000),
      });
      await saveCaliforniaResearchArtifact(db, {
        key: `author:${f.scope.raceKey}`,
        kind: "author",
        raceKey: f.scope.raceKey,
        candidateId: f.scope.candidateId,
        document: f.author,
      });
      const history = await readCaliforniaModelHistory(db, f.scope);
      assert.equal(history.kind, "complete");
      const admission = evaluateCaliforniaSemanticReview({
        history,
        scope: f.scope,
        brief: f.brief,
        now: new Date().toISOString(),
      });
      assert.equal(admission.kind, "clear");
      const reservation = (name: string) => ({
        key: `dispatch:review:${f.scope.raceKey}:${name}`,
        raceKey: f.scope.raceKey,
        candidateId: f.scope.candidateId,
        document: { startedAt: new Date().toISOString(), costUsd: null },
        workLease,
        reviewAdmission: {
          scope: f.scope,
          brief: f.brief,
          proof: admission.proof,
        },
      });
      const [a, b] = await Promise.allSettled([
        claimCaliforniaModelDispatch(reservation("worker-a"), db),
        claimCaliforniaModelDispatch(reservation("worker-b"), db),
      ]);
      assert.equal(
        [a, b].filter((result) => result.status === "fulfilled" && result.value)
          .length,
        1,
      );
      assert.equal(
        [a, b].filter((result) => result.status === "rejected").length,
        1,
      );
      const [dispatch] = await db
        .select()
        .from(CaliforniaResearchArtifact)
        .where(eq(CaliforniaResearchArtifact.kind, "model_dispatch"));
      assert.ok(dispatch);
      await db
        .update(CaliforniaRaceWork)
        .set({
          owner: "replacement",
          generation: 2,
          leaseUntil: new Date(Date.now() + 60_000),
        })
        .where(eq(CaliforniaRaceWork.key, workKey));
      assert.equal(
        await claimCaliforniaModelDispatch(reservation("stale-worker"), db),
        false,
      );
      const unsettled = evaluateCaliforniaSemanticReview({
        history: await readCaliforniaModelHistory(db, f.scope),
        scope: f.scope,
        brief: f.brief,
        now: new Date().toISOString(),
      });
      assert.equal(unsettled.kind, "unavailable");
      await assert.rejects(
        db.transaction((tx) =>
          assertCaliforniaSemanticReviewClear(tx, f.scope, f.brief),
        ),
        /unsettled|canonical result/,
      );
      const lateReview = structuredClone(f.review);
      lateReview.attestation.startedAt = (
        dispatch.document as { startedAt: string }
      ).startedAt;
      lateReview.attestation.completedAt = new Date().toISOString();
      const key = dispatch.key.slice("dispatch:".length);
      await saveCaliforniaResearchArtifact(db, {
        key,
        kind: "review",
        raceKey: f.scope.raceKey,
        candidateId: f.scope.candidateId,
        document: lateReview,
      });
      const rejected = evaluateCaliforniaSemanticReview({
        history: await readCaliforniaModelHistory(db, f.scope),
        scope: f.scope,
        brief: f.brief,
        now: new Date().toISOString(),
      });
      assert.equal(rejected.kind, "rejected");
      await assert.rejects(
        db.transaction((tx) =>
          assertCaliforniaSemanticReviewClear(tx, f.scope, f.brief),
        ),
        /rejected this unchanged public content/,
      );
      const [stored] = await db
        .select()
        .from(CaliforniaResearchArtifact)
        .where(eq(CaliforniaResearchArtifact.key, key));
      assert.deepEqual(stored?.document, lateReview);
      await assert.rejects(
        saveCaliforniaResearchArtifact(db, {
          key,
          kind: "review",
          raceKey: f.scope.raceKey,
          candidateId: f.scope.candidateId,
          document: { ...lateReview, verdict: "approve" },
        }),
        /Conflicting immutable artifact outcome/,
      );
      const conflict = evaluateCaliforniaSemanticReview({
        history: await readCaliforniaModelHistory(db, f.scope),
        scope: f.scope,
        brief: f.brief,
        now: new Date().toISOString(),
      });
      assert.equal(conflict.kind, "unavailable");
      assert.deepEqual(
        (
          await db
            .select()
            .from(CaliforniaResearchArtifact)
            .where(eq(CaliforniaResearchArtifact.key, key))
        )[0]?.document,
        lateReview,
      );
    } finally {
      await db
        .delete(CaliforniaResearchArtifact)
        .where(eq(CaliforniaResearchArtifact.raceKey, f.scope.raceKey));
      await db
        .delete(CaliforniaRaceWork)
        .where(eq(CaliforniaRaceWork.key, workKey));
      await db
        .delete(CaliforniaRoster)
        .where(eq(CaliforniaRoster.id, snapshotId));
    }
  },
);
void test(
  "atomic reservation rejects history changed after observation and complete history never silently truncates",
  { skip: !url },
  async () => {
    const { db } = await import("@acme/db/client");
    const f = candidateReviewHistoryFixture();
    try {
      await saveCaliforniaResearchArtifact(db, {
        key: `author:${f.scope.raceKey}`,
        kind: "author",
        raceKey: f.scope.raceKey,
        candidateId: f.scope.candidateId,
        document: f.author,
      });
      const first = await readCaliforniaModelHistory(db, f.scope);
      assert.equal(first.kind, "complete");
      await saveCaliforniaResearchArtifact(db, {
        key: `review:${f.scope.raceKey}`,
        kind: "review",
        raceKey: f.scope.raceKey,
        candidateId: f.scope.candidateId,
        document: f.review,
      });
      const second = await readCaliforniaModelHistory(db, f.scope);
      assert.equal(second.kind, "complete");
      assert.notEqual(first.proof, second.proof);
      await db.insert(CaliforniaResearchArtifact).values(
        Array.from({ length: 513 }, (_, i) => ({
          key: `bounds:${f.scope.raceKey}:${i}`,
          kind: "model_failure",
          raceKey: f.scope.raceKey,
          candidateId: f.scope.candidateId,
          document: { fixture: true },
        })),
      );
      const capped = await readCaliforniaModelHistory(db, f.scope);
      assert.equal(capped.kind, "unavailable");
      const plan = await db.execute(
        sql`explain (format json) select key,kind,race_key,candidate_id,created_at from california_research_artifact where race_key=${f.scope.raceKey} and candidate_id=${f.scope.candidateId} order by created_at,key limit 513`,
      );
      assert.ok(plan.rows.length);
    } finally {
      await db
        .delete(CaliforniaResearchArtifact)
        .where(eq(CaliforniaResearchArtifact.raceKey, f.scope.raceKey));
    }
  },
);
