import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import {
  californiaRosterSnapshotSchema,
  candidateResearchCollectionSchema,
} from "@acme/validators";

import { readCaliforniaCatalogStatuses } from "./california-catalog-status";
import {
  beginCaliforniaSourceCheck,
  claimCaliforniaRaceWork,
  getCaliforniaResearchArtifact,
  hasCaliforniaResearchArtifact,
  saveCaliforniaResearchArtifact,
  saveCaliforniaRoster,
} from "./california-roster-store";
import { evidenceHashKey } from "./candidate-brief-publication";

const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const textHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
void test(
  "equivalent fresh observations preserve current roster, published coverage and review epochs without rereading shared archives",
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
      CandidateBriefRevision: Revision,
      CandidateBriefReviewEvent: Event,
      CandidateResearchCollection: Collection,
      CandidateRaceRelease: Release,
      CandidateResearchPolicy: Policy,
    } = await import("@acme/db/schema");
    const { saveResearchCollection } =
      await import("./candidate-research-store");
    const { publishResearchCollection } =
      await import("./candidate-research-service");
    const electionDate = "2092-11-03",
      key = `equivalent-${randomUUID()}`,
      version = `equivalent-policy-${randomUUID()}`;
    const identity = {
      candidateId: key,
      contestId: key,
      jurisdiction: `fixture:${key}`,
      electionDate,
    };
    const recordText = "A synthetic official roster lists Fixture Candidate.",
      recordHash = textHash(recordText),
      now = new Date(Date.now() - 2000).toISOString();
    const semanticBasis = {
      stateId: hash("fixture-state"),
      scopeReviewDigest: hash("fixture-scope"),
      identityReviewDigest: hash("fixture-map"),
      claritySemanticDigest: hash([
        identity,
        "Fixture Candidate",
        "on_ballot",
        1,
      ]),
      sources: [
        {
          url: "https://example.gov/assets",
          hash: hash({
            requiredLayer: "districts",
            relevantRows: ["fixture-district"],
          }),
        },
      ],
    };
    const snapshotId = hash(semanticBasis),
      rosterDigest = hash([identity, "Fixture Candidate"]);
    const rawAssets = (telemetry: number) => {
      const text = JSON.stringify({
        layers: [{ id: "districts", rows: ["fixture-district"] }],
        ignoredAssetUpdatedAt: telemetry,
        ignoredTelemetry: { request: telemetry },
      });
      return {
        id: "assets",
        url: "https://example.gov/assets",
        publisher: "Synthetic asset catalog",
        format: "json" as const,
        text,
        contentHash: textHash(text),
        fetchedAt: new Date().toISOString(),
      };
    };
    const sharedArchive = {
      id: "shared-gis",
      url: "https://example.gov/gis",
      publisher: "Synthetic GIS archive",
      format: "json" as const,
      text: "PRIVATE_SHARED_ARCHIVE".repeat(10000),
      contentHash: textHash("PRIVATE_SHARED_ARCHIVE".repeat(10000)),
      fetchedAt: now,
    };
    const initial = californiaRosterSnapshotSchema.parse({
      schemaVersion: 1,
      id: snapshotId,
      electionDate,
      scope: "ca_sos_certified_and_san_jose",
      scopeLabel: "Synthetic semantic roster fixture",
      source: {
        url: "https://example.gov/roster",
        byteHash: recordHash,
        textHash: recordHash,
        fetchedAt: now,
        encoding: "windows-1252",
        text: recordText,
      },
      certification: {
        url: "https://example.gov/certified",
        textHash: recordHash,
        fetchedAt: now,
        text: recordText,
      },
      additionalSources: [rawAssets(1), sharedArchive],
      races: [
        {
          raceKey: key,
          contestId: key,
          jurisdiction: identity.jurisdiction,
          jurisdictionLabel: "Synthetic fixture",
          electionDate,
          sourceContestId: key,
          officeFamily: "local",
          office: "Fixture council",
          district: null,
          kind: "election",
          rosterDigest,
          members: [
            {
              identity,
              candidateId: key,
              name: "Fixture Candidate",
              sourceCandidateId: "fixture-official-1",
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
    const revisionId = randomUUID();
    const collection = candidateResearchCollectionSchema.parse({
      pilotKey: key,
      researchVersion: "equivalence-fixture-v1",
      rosterSnapshotId: snapshotId,
      rosterDigest,
      sources: [
        {
          id: "roster",
          url: initial.source.url,
          publisher: "Synthetic official source",
          format: "text",
          text: recordText,
          contentHash: recordHash,
          fetchedAt: now,
        },
      ],
      problems: [],
      briefs: [
        {
          schemaVersion: 1,
          identity,
          revisionId,
          supersedes: null,
          createdAt: now,
          authorId: "fixture-author",
          authorship: { kind: "human" },
          correction: null,
          evidence: [
            {
              id: "record",
              url: initial.source.url,
              publisher: "Synthetic official source",
              locator: "Fixture record",
              retrievedAt: now,
              documentDate: null,
              contentHash: recordHash,
              excerpt: recordText,
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
            missingEvidence: "Synthetic fixture; no additional evidence.",
            claims:
              topic === "record"
                ? [
                    {
                      id: "record-claim",
                      kind: "fact",
                      text: recordText,
                      evidenceIds: ["record"],
                    },
                  ]
                : [],
          })),
        },
      ],
      manifest: {
        id: randomUUID(),
        contestId: key,
        jurisdiction: identity.jurisdiction,
        jurisdictionLabel: "Synthetic fixture",
        electionDate,
        office: "Fixture council",
        rosterSourceUrl: initial.source.url,
        rosterHash: recordHash,
        rosterVerifiedAt: now,
        rosterVerifiedBy: "fixture",
        members: [
          {
            candidateId: key,
            revisionId,
            name: "Fixture Candidate",
            description: null,
            ballotStatus: "on_ballot",
          },
        ],
        policyVersion: version,
        sourceCheckedAt: now,
        expiresAt: new Date(Date.parse(now) + 86_400_000).toISOString(),
        currentHashes: { [evidenceHashKey(identity, "record")]: recordHash },
      },
    });
    const artifactKeys: string[] = (initial.additionalSources ?? []).map(
        (source) =>
          `roster-source:${hash([source.format, source.contentHash, source.byteHash ?? null])}`,
      ),
      observationKeys: string[] = [],
      rosterIds = [snapshotId];
    let collectionId: string | undefined, releaseId: string | undefined;
    try {
      await saveCaliforniaRoster(db, initial);
      const epoch = await beginCaliforniaSourceCheck(db, electionDate);
      assert.ok(epoch);
      const lease = await claimCaliforniaRaceWork(db, {
        snapshotId,
        raceKey: key,
        rosterDigest,
        policyVersion: version,
        researchVersion: "equivalence-fixture-v1",
        owner: "fixture-worker",
        expectedSourceEpoch: epoch,
      });
      assert.ok(lease);
      const workLease = {
        key: lease.key,
        owner: lease.owner,
        generation: lease.generation,
        reviewEpoch: lease.reviewEpoch,
      };
      await db.insert(Policy).values({
        version,
        approvedBy: "fixture-owner",
        statement:
          "Synthetic policy only for semantic roster persistence and unchanged published coverage tests.",
      });
      collectionId = (
        await saveResearchCollection(collection, db, { workLease })
      ).collectionId;
      await db.insert(Event).values({
        revisionId,
        actorId: "independent-fixture-reviewer",
        action: "approve",
        policyVersion: version,
        reason: "Synthetic exact-revision review",
      });
      releaseId = (
        await publishResearchCollection({
          collectionId,
          actorId: "fixture-owner",
          workLease,
        })
      ).releaseId;
      const [original] = await db
        .select()
        .from(Roster)
        .where(eq(Roster.id, snapshotId));
      assert.ok(original);
      const archiveKey = `roster-source:${hash([sharedArchive.format, sharedArchive.contentHash, null])}`;
      artifactKeys.push(archiveKey);
      await saveCaliforniaResearchArtifact(db, {
        key: archiveKey,
        kind: "roster_source",
        raceKey: "shared-roster",
        document: {
          schemaVersion: 1,
          format: sharedArchive.format,
          text: sharedArchive.text,
          contentHash: sharedArchive.contentHash,
        },
      });
      let keyOnlyReads = 0;
      const measured = new Proxy(db, {
        get(target, property, receiver) {
          if (property !== "select")
            return Reflect.get(target, property, receiver) as unknown;
          return (fields: Parameters<typeof db.select>[0] | undefined) => {
            assert.ok(fields);
            assert.deepEqual(Object.keys(fields), ["key"]);
            assert.equal(Object.values(fields)[0], Artifact.key);
            keyOnlyReads++;
            return db.select(fields);
          };
        },
      });
      const policy = { approved: true, version };
      assert.equal(
        (await readCaliforniaCatalogStatuses(db, policy, electionDate)).races
          .length,
        1,
      );
      let priorChecked = Date.parse(now);
      for (const telemetry of [2, 3]) {
        const checkedAt = new Date().toISOString();
        assert.ok(Date.parse(checkedAt) > priorChecked);
        priorChecked = Date.parse(checkedAt);
        const incoming = californiaRosterSnapshotSchema.parse({
          ...initial,
          additionalSources: [
            rawAssets(telemetry),
            { ...sharedArchive, fetchedAt: checkedAt },
          ],
          source: { ...initial.source, fetchedAt: checkedAt },
          certification: { ...initial.certification, fetchedAt: checkedAt },
        });
        assert.equal(incoming.id, snapshotId);
        await saveCaliforniaRoster(db, incoming, {
          expectedSourceEpoch: epoch,
        });
        assert.equal(
          await hasCaliforniaResearchArtifact(measured, archiveKey),
          true,
        );
        for (const source of incoming.additionalSources ?? []) {
          const bodyKey = `roster-source:${hash([source.format, source.contentHash, source.byteHash ?? null])}`;
          if (!(await hasCaliforniaResearchArtifact(db, bodyKey))) {
            artifactKeys.push(bodyKey);
            await saveCaliforniaResearchArtifact(db, {
              key: bodyKey,
              kind: "roster_source",
              raceKey: "shared-roster",
              document: {
                schemaVersion: 1,
                format: source.format,
                text: source.text,
                contentHash: source.contentHash,
                ...(source.byteHash ? { byteHash: source.byteHash } : {}),
                ...(source.binaryBase64
                  ? { binaryBase64: source.binaryBase64 }
                  : {}),
              },
            });
          }
        }
        const observationKey = `roster-check:${snapshotId}:${epoch.generation}:${randomUUID()}`;
        artifactKeys.push(observationKey);
        observationKeys.push(observationKey);
        await saveCaliforniaResearchArtifact(db, {
          key: observationKey,
          kind: "roster_check",
          raceKey: "shared-roster",
          document: {
            schemaVersion: 2,
            snapshotId,
            checkedAt,
            sourceEpoch: epoch,
            sources: incoming.additionalSources?.map((source) => ({
              archiveKey:
                source.id === "shared-gis"
                  ? archiveKey
                  : `roster-source:${hash([source.format, source.contentHash, null])}`,
              id: source.id,
              url: source.url,
              publisher: source.publisher,
              format: source.format,
              contentHash: source.contentHash,
              fetchedAt: checkedAt,
            })),
            sourceProjectionProofs: [
              {
                semanticDigest: semanticBasis.sources[0]?.hash,
                observedAssetTelemetry: telemetry,
              },
            ],
          },
        });
        const refreshed = structuredClone(collection);
        refreshed.sources = refreshed.sources.map((source) => ({
          ...source,
          fetchedAt: checkedAt,
        }));
        refreshed.manifest.sourceCheckedAt = checkedAt;
        refreshed.manifest.rosterVerifiedAt = checkedAt;
        refreshed.manifest.expiresAt = new Date(
          Date.parse(checkedAt) + 86_400_000,
        ).toISOString();
        const unchanged = await saveResearchCollection(refreshed, db, {
          workLease,
        });
        assert.equal(unchanged.changed, false);
        assert.equal(unchanged.collectionId, collectionId);
        const [stored] = await db
          .select()
          .from(Roster)
          .where(eq(Roster.id, snapshotId));
        assert.ok(stored);
        assert.deepEqual(stored.document, original.document);
        assert.equal(
          stored.createdAt.toISOString(),
          original.createdAt.toISOString(),
        );
        const [work] = await db
          .select()
          .from(Work)
          .where(eq(Work.key, lease.key));
        assert.ok(work);
        assert.equal(work.reviewEpoch, lease.reviewEpoch);
        assert.equal(work.generation, lease.generation);
        assert.deepEqual(
          await beginCaliforniaSourceCheck(db, electionDate),
          epoch,
        );
        const current = await readCaliforniaCatalogStatuses(
          db,
          policy,
          electionDate,
        );
        assert.equal(current.snapshot?.id, snapshotId);
        assert.equal(current.races.length, 1);
        const [released] = await db
          .select()
          .from(Release)
          .where(eq(Release.id, releaseId));
        assert.ok(released);
        assert.equal(released.revokedReason, null);
        assert.equal(released.document.sourceCheckedAt, checkedAt);
        assert.equal(
          released.document.expiresAt,
          new Date(Date.parse(checkedAt) + 86_400_000).toISOString(),
        );
      }
      assert.equal(keyOnlyReads, 2);
      const shared = await getCaliforniaResearchArtifact(db, archiveKey);
      assert.deepEqual(shared, {
        schemaVersion: 1,
        format: sharedArchive.format,
        text: sharedArchive.text,
        contentHash: sharedArchive.contentHash,
      });
      const observations = await db
        .select()
        .from(Artifact)
        .where(inArray(Artifact.key, observationKeys));
      assert.equal(observations.length, 2);
      for (const [index, change] of [
        {
          ...semanticBasis,
          claritySemanticDigest: hash("changed real member"),
        },
        {
          ...semanticBasis,
          identityReviewDigest: hash("changed official mapping"),
        },
        {
          ...semanticBasis,
          sources: [
            {
              url: "https://example.gov/authority",
              hash: hash("changed authority provision"),
            },
          ],
        },
      ].entries()) {
        const changedId = hash(change);
        rosterIds.push(changedId);
        const currentEpoch = await beginCaliforniaSourceCheck(db, electionDate);
        assert.ok(currentEpoch);
        await saveCaliforniaRoster(
          db,
          { ...initial, id: changedId },
          { expectedSourceEpoch: currentEpoch },
        );
        const [work] = await db
          .select()
          .from(Work)
          .where(eq(Work.key, lease.key));
        assert.ok(work);
        assert.equal(work.reviewEpoch, lease.reviewEpoch + index + 1);
        assert.equal(
          (await readCaliforniaCatalogStatuses(db, policy, electionDate)).races
            .length,
          0,
        );
      }
    } finally {
      if (releaseId) await db.delete(Release).where(eq(Release.id, releaseId));
      await db.delete(Event).where(eq(Event.revisionId, revisionId));
      if (collectionId)
        await db.delete(Collection).where(eq(Collection.id, collectionId));
      await db.delete(Revision).where(eq(Revision.id, revisionId));
      if (artifactKeys.length)
        await db.delete(Artifact).where(inArray(Artifact.key, artifactKeys));
      await db.delete(Work).where(inArray(Work.snapshotId, rosterIds));
      await db.delete(Work).where(eq(Work.key, `source-epoch:${electionDate}`));
      await db.delete(Roster).where(inArray(Roster.id, rosterIds));
      await db.delete(Policy).where(eq(Policy.version, version));
    }
  },
);
