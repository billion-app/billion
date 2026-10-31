import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import {
  californiaRosterSnapshotSchema,
  candidateResearchCollectionSchema,
} from "@acme/validators";

import {
  beginCaliforniaSourceCheck,
  claimCaliforniaModelDispatch,
  claimCaliforniaRaceWork,
  hasCaliforniaResearchArtifact,
  saveCaliforniaRaceCheckpoint,
  saveCaliforniaResearchArtifact,
  saveCaliforniaRoster,
} from "./california-roster-store";

for (const withCollection of [false, true])
  void test(
    `required source failure preserves attempted provenance and fences ${withCollection ? "collected research" : "unfinished backfill"}`,
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
        CandidateRaceRelease: Release,
      } = await import("@acme/db/schema");
      const { failResearchRefresh } =
        await import("./candidate-research-store");
      const hash = (text: string) =>
          createHash("sha256").update(text).digest("hex"),
        id = hash(randomUUID()),
        raceKey = `backfill-${randomUUID()}`,
        electionDate = `${3000 + Math.floor(Math.random() * 6000)}-11-03`,
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
      const collectionId = randomUUID(),
        releaseId = randomUUID(),
        siblingWorkKey = randomUUID();
      const attemptedAt = new Date(Date.now() - 1000).toISOString();
      const oldAttemptedAt = "2000-01-01T00:00:00.000Z";
      const reason = "A previously cited candidate page changed";
      const attempt = {
        attemptedAt,
        checkpoint: {
          attemptedAt,
          kind: "source_failure",
          reason: "Worker diagnostic must not override required review reason",
          dossierDigests: { [identity.candidateId]: `failed-dossier:${id}` },
          dossierReviewEpochs: { [identity.candidateId]: 0 },
          sourceFailure: {
            url: "https://example.gov/changed",
            observedHash: id,
          },
        },
      };
      const dossierKey = `dossier:${randomUUID()}`,
        oldDispatch = `dispatch:review:${randomUUID()}:0`,
        newDispatch = `dispatch:review:${randomUUID()}:1`,
        staleDispatch = `dispatch:review:${randomUUID()}:stale`;
      try {
        assert.deepEqual(
          await db
            .select()
            .from(Roster)
            .where(eq(Roster.electionDate, electionDate)),
          [],
        );
        assert.deepEqual(
          await db
            .select()
            .from(Work)
            .where(eq(Work.key, `source-epoch:${electionDate}`)),
          [],
        );
        await saveCaliforniaRoster(db, snapshot);
        if (withCollection) {
          const revisionId = randomUUID();
          const document = candidateResearchCollectionSchema.parse({
            pilotKey: raceKey,
            problems: [],
            sources: [
              {
                id: "source",
                url: "https://example.gov/roster",
                publisher: "Synthetic fixture",
                format: "text",
                text: "Synthetic fixture",
                contentHash: id,
                fetchedAt: now,
              },
            ],
            briefs: [
              {
                schemaVersion: 1,
                identity,
                revisionId,
                supersedes: null,
                createdAt: now,
                authorId: "fixture",
                authorship: { kind: "human" },
                correction: null,
                evidence: [
                  {
                    id: "source",
                    url: "https://example.gov/roster",
                    publisher: "Synthetic fixture",
                    locator: "Fixture",
                    retrievedAt: now,
                    documentDate: null,
                    contentHash: id,
                    excerpt: "Synthetic fixture",
                    origin: "primary_record",
                  },
                ],
                sections: [
                  "priorities",
                  "record",
                  "mechanisms",
                  "effects",
                  "tradeoffs",
                  "unknowns",
                ].map((topic) => ({
                  topic,
                  missingEvidence: "Synthetic fixture; no real research.",
                  claims: [],
                })),
              },
            ],
            manifest: {
              id: releaseId,
              ...identity,
              office: "Fixture council",
              jurisdictionLabel: "Synthetic fixture",
              rosterSourceUrl: "https://example.gov/roster",
              rosterHash: id,
              rosterVerifiedAt: now,
              rosterVerifiedBy: "fixture",
              members: [
                {
                  candidateId: raceKey,
                  revisionId,
                  name: "Fixture candidate",
                  description: null,
                  ballotStatus: "on_ballot",
                },
              ],
              policyVersion: "fixture-policy",
              sourceCheckedAt: now,
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              currentHashes: {},
            },
          });
          await db.insert(Collection).values({
            id: collectionId,
            pilotKey: raceKey,
            sourceDigest: id,
            document,
            checkedAt: new Date(now),
          });
          await db
            .insert(Release)
            .values({ id: releaseId, document: document.manifest });
        }
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
          document: {
            classification: "supported",
            sourceHash: "old-page-hash",
          },
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
              attemptedAt: oldAttemptedAt,
              retainedMarker: "earlier attempt",
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
        assert.equal(
          (
            await db
              .select()
              .from(Collection)
              .where(eq(Collection.pilotKey, raceKey))
          ).length,
          withCollection ? 1 : 0,
        );
        for (const invalid of [
          { attemptedAt: "not-a-timestamp", checkpoint: {} },
          {
            attemptedAt: new Date(Date.now() + 60_000).toISOString(),
            checkpoint: {},
          },
          {
            attemptedAt,
            checkpoint: null as unknown as Record<string, unknown>,
          },
          { attemptedAt, checkpoint: [] as unknown as Record<string, unknown> },
        ]) {
          await assert.rejects(
            failResearchRefresh(raceKey, reason, db, {
              workLease: retryLease,
              attempted: invalid,
            }),
            /attempt timestamp|attempt checkpoint/,
          );
        }
        await assert.rejects(
          failResearchRefresh(raceKey, reason, db, { attempted: attempt }),
          /attempt requires a current work lease/,
        );
        const [beforeFailure] = await db
          .select()
          .from(Work)
          .where(eq(Work.key, providerRetry.key));
        assert.deepEqual(beforeFailure, providerRetry);
        await db.insert(Work).values({
          key: siblingWorkKey,
          snapshotId: id,
          raceKey,
          rosterDigest: id,
          policyVersion: "older-policy",
          researchVersion: "fixture-v1",
          checkpoint: { attemptedAt: oldAttemptedAt, sibling: true },
        });
        await failResearchRefresh(raceKey, reason, db, {
          workLease: retryLease,
          attempted: attempt,
        });
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
        const [sibling] = await db
          .select()
          .from(Work)
          .where(eq(Work.key, siblingWorkKey));
        assert.ok(sibling);
        assert.equal(
          (sibling.checkpoint as Record<string, unknown>).attemptedAt,
          oldAttemptedAt,
        );
        assert.equal(
          (sibling.checkpoint as Record<string, unknown>).sourceFailure,
          undefined,
        );
        const checkpoint = fenced.checkpoint as Record<string, unknown>;
        assert.equal(checkpoint.attemptedAt, attemptedAt);
        assert.equal(checkpoint.retainedMarker, "earlier attempt");
        assert.deepEqual(
          checkpoint.dossierDigests,
          attempt.checkpoint.dossierDigests,
        );
        assert.deepEqual(
          checkpoint.sourceFailure,
          attempt.checkpoint.sourceFailure,
        );
        assert.equal(checkpoint.kind, "required_independent_review");
        assert.equal(checkpoint.reason, reason);
        if (withCollection) {
          const [collection] = await db
            .select()
            .from(Collection)
            .where(eq(Collection.id, collectionId));
          const [release] = await db
            .select()
            .from(Release)
            .where(eq(Release.id, releaseId));
          assert.equal(collection?.failure, reason);
          assert.equal(release?.revokedReason, reason);
        }
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
            {
              workLease: retryLease,
              attempted: {
                attemptedAt,
                checkpoint: { attemptedAt, stale: true },
              },
            },
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
        assert.deepEqual(current.checkpoint, fenced.checkpoint);
        assert.equal(current.owner, fresh.owner);
        assert.equal(current.generation, fresh.generation);
        assert.equal(current.reviewEpoch, fresh.reviewEpoch);
        assert.equal(
          (
            await db
              .select()
              .from(Collection)
              .where(eq(Collection.pilotKey, raceKey))
          ).length,
          withCollection ? 1 : 0,
        );
      } finally {
        await db.delete(Release).where(eq(Release.id, releaseId));
        await db.delete(Collection).where(eq(Collection.id, collectionId));
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
