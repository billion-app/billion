import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import { californiaRosterSnapshotSchema } from "@acme/validators";

import {
  beginCaliforniaSourceCheck,
  claimCaliforniaModelDispatch,
  claimCaliforniaRaceWork,
  hasCaliforniaResearchArtifact,
  saveCaliforniaRaceCheckpoint,
  saveCaliforniaResearchArtifact,
  saveCaliforniaRoster,
} from "./california-roster-store";

void test(
  "required source failure fences unfinished backfill without creating a collection and permits immediate fresh review work",
  { skip: !process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL },
  async () => {
    const url = process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL;
    assert.ok(url);
    const target = new URL(url);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(target.hostname) &&
        target.pathname.endsWith("_test"),
    );
    process.env.POSTGRES_URL = url;
    const { db } = await import("@acme/db/client");
    const { eq, inArray } = await import("@acme/db");
    const {
      CaliforniaRoster: Roster,
      CaliforniaRaceWork: Work,
      CaliforniaResearchArtifact: Artifact,
      CandidateResearchCollection: Collection,
    } = await import("@acme/db/schema");
    const { failResearchRefresh } = await import("./candidate-research-store");
    const hash = (text: string) =>
        createHash("sha256").update(text).digest("hex"),
      id = hash(randomUUID()),
      raceKey = `backfill-${randomUUID()}`,
      electionDate = "2091-11-03",
      now = new Date().toISOString();
    const identity = {
      candidateId: raceKey,
      contestId: raceKey,
      jurisdiction: `fixture:${raceKey}`,
      electionDate,
    };
    const snapshot = californiaRosterSnapshotSchema.parse({
      schemaVersion: 1,
      id,
      electionDate,
      scope: "ca_sos_certified",
      scopeLabel: "Synthetic unfinished-backfill fixture",
      source: {
        url: "https://example.gov/roster",
        byteHash: id,
        textHash: id,
        fetchedAt: now,
        encoding: "windows-1252",
        text: "Synthetic fixture",
      },
      certification: {
        url: "https://example.gov/certified",
        textHash: id,
        fetchedAt: now,
        text: "Synthetic fixture",
      },
      races: [
        {
          raceKey,
          contestId: raceKey,
          jurisdiction: identity.jurisdiction,
          jurisdictionLabel: "Synthetic fixture",
          electionDate,
          sourceContestId: raceKey,
          officeFamily: "local",
          office: "Fixture council",
          district: null,
          kind: "election",
          rosterDigest: id,
          members: [
            {
              identity,
              candidateId: raceKey,
              name: "Fixture candidate",
              sourceCandidateId: "fixture-1",
              partyCode: "",
              party: null,
              ballotStatus: "on_ballot",
            },
          ],
        },
      ],
      excludedContests: [],
      countyCoverage: [],
    });
    const dossierKey = `dossier:${randomUUID()}`,
      oldDispatch = `dispatch:review:${randomUUID()}:0`,
      newDispatch = `dispatch:review:${randomUUID()}:1`,
      staleDispatch = `dispatch:review:${randomUUID()}:stale`;
    try {
      await saveCaliforniaRoster(db, snapshot);
      const epoch = await beginCaliforniaSourceCheck(db, electionDate);
      assert.ok(epoch);
      const claimInput = {
        snapshotId: id,
        raceKey,
        rosterDigest: id,
        policyVersion: "fixture-policy",
        researchVersion: "fixture-v1",
        expectedSourceEpoch: epoch,
      };
      const first = await claimCaliforniaRaceWork(db, {
        ...claimInput,
        owner: "first-worker",
      });
      assert.ok(first);
      const firstLease = {
        key: first.key,
        owner: first.owner,
        generation: first.generation,
        reviewEpoch: first.reviewEpoch,
      };
      await saveCaliforniaResearchArtifact(db, {
        key: dossierKey,
        kind: "dossier",
        raceKey,
        candidateId: identity.candidateId,
        document: { classification: "supported", sourceHash: "old-page-hash" },
      });
      assert.equal(
        await claimCaliforniaModelDispatch(
          {
            key: oldDispatch,
            raceKey,
            candidateId: identity.candidateId,
            document: { startedAt: now, costUsd: null },
            workLease: firstLease,
          },
          db,
        ),
        true,
      );
      assert.equal(
        await saveCaliforniaRaceCheckpoint(db, {
          ...firstLease,
          status: "blocked",
          checkpoint: {
            reason: "Provider outcome is uncertain",
            dossierDigests: { [identity.candidateId]: dossierKey },
            dossierReviewEpochs: { [identity.candidateId]: 0 },
          },
        }),
        true,
      );
      const providerRetry = await claimCaliforniaRaceWork(db, {
        ...claimInput,
        owner: "provider-retry",
      });
      assert.ok(providerRetry);
      assert.equal(providerRetry.reviewEpoch, first.reviewEpoch);
      const retryLease = {
        key: providerRetry.key,
        owner: providerRetry.owner,
        generation: providerRetry.generation,
        reviewEpoch: providerRetry.reviewEpoch,
      };
      assert.equal(
        await claimCaliforniaModelDispatch(
          {
            key: oldDispatch,
            raceKey,
            document: { startedAt: now, costUsd: null },
            workLease: retryLease,
          },
          db,
        ),
        false,
      );
      assert.deepEqual(
        await db
          .select()
          .from(Collection)
          .where(eq(Collection.pilotKey, raceKey)),
        [],
      );
      await failResearchRefresh(
        raceKey,
        "A previously cited candidate page changed",
        db,
        { workLease: retryLease },
      );
      const [fenced] = await db
        .select()
        .from(Work)
        .where(eq(Work.key, providerRetry.key));
      assert.ok(fenced);
      assert.equal(fenced.reviewEpoch, providerRetry.reviewEpoch + 1);
      assert.ok(fenced.generation > providerRetry.generation);
      assert.equal(fenced.status, "pending");
      assert.equal(fenced.owner, null);
      assert.equal(fenced.leaseUntil, null);
      assert.deepEqual(
        (fenced.checkpoint as { dossierReviewEpochs: unknown })
          .dossierReviewEpochs,
        { [identity.candidateId]: 0 },
      );
      const fresh = await claimCaliforniaRaceWork(db, {
        ...claimInput,
        owner: "fresh-source-worker",
      });
      assert.ok(fresh);
      assert.equal(fresh.reviewEpoch, fenced.reviewEpoch);
      const freshLease = {
        key: fresh.key,
        owner: fresh.owner,
        generation: fresh.generation,
        reviewEpoch: fresh.reviewEpoch,
      };
      await assert.rejects(
        failResearchRefresh(
          raceKey,
          "Stale worker must not reset current work",
          db,
          { workLease: retryLease },
        ),
        /expired or was superseded/,
      );
      assert.equal(
        await saveCaliforniaRaceCheckpoint(db, {
          ...retryLease,
          status: "complete",
          checkpoint: { stale: true },
        }),
        false,
      );
      assert.equal(
        await claimCaliforniaModelDispatch(
          {
            key: staleDispatch,
            raceKey,
            document: { startedAt: now, costUsd: null },
            workLease: retryLease,
          },
          db,
        ),
        false,
      );
      assert.equal(
        await hasCaliforniaResearchArtifact(db, staleDispatch),
        false,
      );
      assert.equal(
        await claimCaliforniaModelDispatch(
          {
            key: newDispatch,
            raceKey,
            document: { startedAt: now, costUsd: null },
            workLease: freshLease,
          },
          db,
        ),
        true,
      );
      const [current] = await db
        .select()
        .from(Work)
        .where(eq(Work.key, fresh.key));
      assert.ok(current);
      assert.equal(current.owner, fresh.owner);
      assert.equal(current.generation, fresh.generation);
      assert.equal(current.reviewEpoch, fresh.reviewEpoch);
      assert.deepEqual(
        await db
          .select()
          .from(Collection)
          .where(eq(Collection.pilotKey, raceKey)),
        [],
      );
    } finally {
      await db
        .delete(Artifact)
        .where(
          inArray(Artifact.key, [
            dossierKey,
            oldDispatch,
            newDispatch,
            staleDispatch,
          ]),
        );
      await db.delete(Work).where(eq(Work.snapshotId, id));
      await db.delete(Roster).where(eq(Roster.id, id));
    }
  },
);
