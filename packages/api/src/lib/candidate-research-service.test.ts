import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import {
  campaignFinanceSchema,
  candidateDossierSemanticProjection,
  candidateDossierSourceProjection,
  candidateModelAttestationSchema,
  candidateResearchCollectionSchema,
} from "@acme/validators";

import {
  briefDigest,
  evidenceHashKey,
  ResearchReviewCollectionConflict,
} from "./candidate-brief-publication";
import { readCandidateRace } from "./candidate-race-release";
import { validResearchAttestation } from "./candidate-research-attestation";

function required<T>(value: T | undefined): T {
  assert.ok(value);
  return value;
}

function fixture(key: string = randomUUID()) {
  const now = new Date(Date.now() - 1000).toISOString();
  const text =
    "A synthetic public record shows Fixture candidate chaired the library committee.";
  const hash = createHash("sha256").update(text).digest("hex");
  const identity = {
    candidateId: key,
    contestId: key,
    jurisdiction: `fixture:${key}`,
    electionDate: "2026-11-03",
  };
  const brief = {
    schemaVersion: 1,
    identity,
    revisionId: randomUUID(),
    supersedes: null,
    createdAt: now,
    authorId: "test-author",
    authorship: { kind: "human" },
    correction: null,
    evidence: [
      {
        id: "record",
        url: "https://example.org/record",
        publisher: "Fixture",
        locator: "Record",
        retrievedAt: now,
        documentDate: null,
        contentHash: hash,
        excerpt: text,
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
      missingEvidence: "Evidence was not collected for this synthetic fixture.",
      claims:
        topic === "record"
          ? [
              {
                id: "record-claim",
                kind: "fact",
                text,
                evidenceIds: ["record"],
              },
            ]
          : [],
    })),
  };
  return candidateResearchCollectionSchema.parse({
    pilotKey: key,
    briefs: [brief],
    sources: [
      {
        id: "record",
        url: "https://example.org/record",
        publisher: "Fixture",
        format: "text",
        text,
        contentHash: hash,
        fetchedAt: now,
      },
    ],
    problems: [],
    manifest: {
      id: randomUUID(),
      ...identity,
      jurisdictionLabel: "Fixture",
      office: "Mayor",
      rosterSourceUrl: "https://example.org/record",
      rosterHash: hash,
      rosterVerifiedAt: now,
      rosterVerifiedBy: "fixture",
      members: [
        {
          candidateId: key,
          revisionId: brief.revisionId,
          name: "Fixture candidate",
          description: null,
          ballotStatus: "on_ballot",
        },
      ],
      policyVersion: "test-policy",
      sourceCheckedAt: now,
      expiresAt: new Date(Date.parse(now) + 86_400_000).toISOString(),
      currentHashes: { [evidenceHashKey(identity, "record")]: hash },
    },
  });
}

void test("AI approval requires exact candidate claims, source dossier, policy and independent invocations", () => {
  const collection = fixture();
  const brief = required(collection.briefs[0]);
  brief.authorship = {
    kind: "generated",
    model: "author-actual",
    promptVersion: "v1",
  };
  const author = {
    role: "author",
    actorId: brief.authorId,
    runId: randomUUID(),
    configuredModel: "author-config",
    actualModel: "author-actual",
    provider: "fixture",
    requestId: null,
    promptVersion: "v1",
    policyVersion: "test-policy",
    sourceSetDigest: "a".repeat(64),
    dossierDigest: "b".repeat(64),
    revisionDigest: briefDigest(brief),
    startedAt: brief.createdAt,
    completedAt: brief.createdAt,
    usage: { inputTokens: 10, outputTokens: 10 },
    costUsd: null,
  };
  const reviewer = {
    ...author,
    role: "reviewer",
    actorId: "test-reviewer",
    runId: randomUUID(),
    configuredModel: "review-config",
    actualModel: "review-actual",
  };
  const quality = {
    basis: "candidate_record" as const,
    claimIds: ["record-claim"],
    evidenceIds: ["record"],
  };
  const value = {
    quality,
    author,
    reviewer,
    verdict: "approve",
    findings: [
      {
        claimId: "record-claim",
        supported: true,
        reason: "Exact archived quote supports the claim.",
      },
    ],
  };
  const input = {
    value,
    brief,
    policyVersion: "test-policy",
    automation: {
      serviceActorId: "service",
      allowedAuthorModels: ["author-actual"],
      allowedReviewerModels: ["review-actual"],
      researchVersion: "v1",
    },
    dossier: {
      dossierDigest: author.dossierDigest,
      sourceSetDigest: author.sourceSetDigest,
      authorRunId: author.runId,
      quality,
    },
    now: new Date().toISOString(),
  };
  assert.equal(validResearchAttestation(input), true);
  assert.equal(
    validResearchAttestation({
      ...input,
      value: { ...value, quality: undefined },
    }),
    false,
  );
  assert.equal(
    validResearchAttestation({
      ...input,
      value: { ...value, quality: { ...quality, claimIds: ["unrelated"] } },
    }),
    false,
  );
  assert.equal(
    validResearchAttestation({
      ...input,
      value: {
        ...value,
        quality: { ...quality, basis: "candidate_priorities" },
      },
    }),
    false,
  );
  const collectionId = randomUUID();
  const publishedInput = {
    manifest: {
      ...collection.manifest,
      collectionId,
      sourceDigest: "e".repeat(64),
      rosterSnapshotId: "snapshot",
      rosterDigest: "f".repeat(64),
      reviewedDossiers: { [brief.identity.candidateId]: input.dossier },
    },
    currentRoster: {
      snapshotId: "snapshot",
      rosterDigest: "f".repeat(64),
      candidateIds: [brief.identity.candidateId],
      contestId: brief.identity.contestId,
      electionDate: brief.identity.electionDate,
      jurisdiction: brief.identity.jurisdiction,
    },
    revokedReason: null,
    revisions: [
      {
        id: brief.revisionId,
        revisionDigest: briefDigest(brief),
        document: brief,
      },
    ],
    events: [
      {
        revisionId: brief.revisionId,
        actorId: reviewer.actorId,
        action: "approve",
        policyVersion: input.policyVersion,
        createdAt: new Date(input.now),
        attestation: { ...value, collectionId },
      },
    ],
    now: input.now,
    policy: {
      approved: true,
      version: input.policyVersion,
      automation: input.automation,
    },
  };
  assert.ok(readCandidateRace(publishedInput));
  assert.equal(
    readCandidateRace({
      ...publishedInput,
      events: [
        {
          ...required(publishedInput.events[0]),
          createdAt: new Date(Date.parse(input.now) + 1000),
        },
      ],
    }),
    null,
  );
  assert.equal(
    readCandidateRace({
      ...publishedInput,
      manifest: {
        ...publishedInput.manifest,
        reviewedDossiers: {
          [brief.identity.candidateId]: {
            ...input.dossier,
            quality: undefined,
          },
        },
      },
    }),
    null,
  );
  assert.equal(
    readCandidateRace({
      ...publishedInput,
      events: [
        {
          ...required(publishedInput.events[0]),
          attestation: { ...value, collectionId, quality: undefined },
        },
      ],
    }),
    null,
  );
  assert.equal(
    readCandidateRace({ ...publishedInput, currentRoster: undefined }),
    null,
  );
  assert.equal(
    readCandidateRace({
      ...publishedInput,
      currentRoster: undefined,
      manifest: { ...collection.manifest },
    }),
    null,
  );
  assert.equal(
    readCandidateRace({
      ...publishedInput,
      events: [{ ...required(publishedInput.events[0]), attestation: null }],
    }),
    null,
  );
  assert.equal(
    readCandidateRace({
      ...publishedInput,
      events: [
        {
          ...required(publishedInput.events[0]),
          attestation: { ...value, collectionId: randomUUID() },
        },
      ],
    }),
    null,
  );
  for (const bad of [
    { ...value, verdict: "reject" },
    { ...value, findings: [] },
    { ...value, findings: [{ ...value.findings[0], supported: false }] },
    { ...value, reviewer: { ...reviewer, actorId: author.actorId } },
    { ...value, reviewer: { ...reviewer, runId: author.runId } },
    { ...value, reviewer: { ...reviewer, revisionDigest: "c".repeat(64) } },
    { ...value, reviewer: { ...reviewer, sourceSetDigest: "c".repeat(64) } },
    { ...value, reviewer: { ...reviewer, policyVersion: "other-policy" } },
    { ...value, reviewer: { ...reviewer, actualModel: "unapproved-model" } },
  ])
    assert.equal(validResearchAttestation({ ...input, value: bad }), false);
});

void test("current authoritative membership suppresses a formerly complete release", () => {
  const collection = fixture();
  const brief = required(collection.briefs[0]);
  const input = {
    manifest: collection.manifest,
    revokedReason: null,
    revisions: [
      {
        id: brief.revisionId,
        document: brief,
        revisionDigest: briefDigest(brief),
      },
    ],
    events: [
      {
        revisionId: brief.revisionId,
        actorId: "independent",
        action: "approve",
        policyVersion: "test-policy",
        createdAt: new Date(),
      },
    ],
    now: new Date().toISOString(),
    policy: { approved: true, version: "test-policy" },
  };
  assert.ok(readCandidateRace(input));
  assert.equal(
    readCandidateRace({
      ...input,
      currentRoster: {
        snapshotId: "new",
        rosterDigest: "a".repeat(64),
        candidateIds: [brief.identity.candidateId, "new-member"],
        contestId: brief.identity.contestId,
        electionDate: brief.identity.electionDate,
        jurisdiction: brief.identity.jurisdiction,
      },
    }),
    null,
  );
  assert.equal(
    readCandidateRace({
      ...input,
      events: [
        ...input.events,
        { ...required(input.events[0]), action: "reject" },
      ],
    }),
    null,
  );
});

void test(
  "atomic policy cutover preserves every public race and source failures fence delayed publication",
  { skip: !process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL },
  async () => {
    const url = required(process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL);
    const target = new URL(url);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(target.hostname) &&
        target.pathname.startsWith("/billion_candidate_") &&
        target.pathname.endsWith("_test"),
    );
    process.env.POSTGRES_URL = url;
    const { db } = await import("@acme/db/client");
    const { eq, inArray } = await import("@acme/db");
    const {
      CandidateBriefReviewEvent: Event,
      CandidateBriefRevision: Revision,
      CandidateResearchCollection: Collection,
      CandidateResearchPolicy: Policy,
      CandidateRaceRelease: Release,
    } = await import("@acme/db/schema");
    const {
      saveResearchCollection,
      failResearchRefresh,
      activeResearchPolicy,
      lockPilot,
    } = await import("./candidate-research-store");
    const { publishResearchCollection, adoptResearchPolicy } =
      await import("./candidate-research-service");
    const suffix = randomUUID();
    const oldVersion = `old-${suffix}`,
      newVersion = `new-${suffix}`;
    const collections = [fixture(), fixture()];
    const savedIds: string[] = [];
    const allSavedIds: string[] = [];
    const revisionIds = collections.map(
      (c) => required(c.briefs[0]).revisionId,
    );
    const releaseIds: string[] = [];
    try {
      await db.insert(Policy).values({
        version: oldVersion,
        approvedBy: "test-owner",
        statement: "Synthetic test policy.",
      });
      for (const collection of collections) {
        const saved = await saveResearchCollection(collection);
        savedIds.push(saved.collectionId);
        allSavedIds.push(saved.collectionId);
        await db.insert(Event).values(
          [oldVersion, newVersion].map((version) => ({
            revisionId: required(collection.briefs[0]).revisionId,
            actorId: "independent-fixture",
            action: "approve",
            policyVersion: version,
            reason: "Synthetic exact-revision review",
            createdAt: new Date(),
          })),
        );
        releaseIds.push(
          (
            await publishResearchCollection({
              collectionId: saved.collectionId,
              actorId: "test-owner",
            })
          ).releaseId,
        );
      }
      for (const [index, prior] of collections.entries()) {
        const staged = structuredClone(prior);
        staged.researchVersion = "future-policy-test";
        required(staged.briefs[0]).revisionId = randomUUID();
        required(staged.manifest.members[0]).revisionId = required(
          staged.briefs[0],
        ).revisionId;
        revisionIds.push(required(staged.briefs[0]).revisionId);
        const saved = await saveResearchCollection(staged, db, {
          stagedPolicyVersion: newVersion,
        });
        allSavedIds.push(saved.collectionId);
        savedIds[index] = saved.collectionId;
        await db.insert(Event).values({
          revisionId: required(staged.briefs[0]).revisionId,
          actorId: "independent-fixture",
          action: "approve",
          policyVersion: newVersion,
          reason: "Exact prepared replacement review",
          createdAt: new Date(),
        });
        const [old] = await db
          .select()
          .from(Release)
          .where(eq(Release.id, required(releaseIds[index])));
        assert.equal(
          old?.revokedReason,
          null,
          "Preparing unchanged cited sources preserves the current public release",
        );
      }
      const policy = {
        version: newVersion,
        approvedBy: "test-owner",
        statement:
          "This synthetic test policy verifies atomic replacement of every currently public race without loss of coverage.",
      };
      await assert.rejects(
        adoptResearchPolicy({ policy, collectionIds: [required(savedIds[0])] }),
        /every currently public race/,
      );
      assert.equal((await activeResearchPolicy()).version, oldVersion);
      const adopted = await adoptResearchPolicy({
        policy,
        collectionIds: savedIds,
      });
      releaseIds.push(...adopted.releaseIds);
      assert.equal((await activeResearchPolicy()).version, newVersion);
      assert.equal(adopted.releaseIds.length, 2);
      const repeat = await publishResearchCollection({
        collectionId: required(savedIds[0]),
        actorId: "test-owner",
      });
      assert.ok(adopted.releaseIds.includes(repeat.releaseId));
      let releaseLock!: () => void;
      const unlocked = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      let acquired!: () => void;
      const ready = new Promise<void>((resolve) => {
        acquired = resolve;
      });
      const failure = db.transaction(async (tx) => {
        await lockPilot(tx, required(collections[0]).pilotKey);
        acquired();
        await unlocked;
        await tx
          .update(Collection)
          .set({ failure: "Source unavailable" })
          .where(eq(Collection.id, required(savedIds[0])));
        await tx
          .update(Release)
          .set({ revokedReason: "Source unavailable" })
          .where(inArray(Release.id, releaseIds));
      });
      await ready;
      const delayed = publishResearchCollection({
        collectionId: required(savedIds[0]),
        actorId: "test-owner",
      });
      releaseLock();
      await failure;
      await assert.rejects(delayed, /incomplete or stale/);
      await failResearchRefresh(
        required(collections[1]).pilotKey,
        "Required source failed",
      );
      await assert.rejects(
        publishResearchCollection({
          collectionId: required(savedIds[1]),
          actorId: "test-owner",
        }),
        /incomplete or stale/,
      );
    } finally {
      if (releaseIds.length)
        await db.delete(Release).where(inArray(Release.id, releaseIds));
      await db.delete(Event).where(inArray(Event.revisionId, revisionIds));
      if (allSavedIds.length)
        await db.delete(Collection).where(inArray(Collection.id, allSavedIds));
      await db.delete(Revision).where(inArray(Revision.id, revisionIds));
      await db
        .delete(Policy)
        .where(inArray(Policy.version, [oldVersion, newVersion]));
    }
  },
);

void test(
  "expired race attempts cannot save or publish over a newer durable generation",
  { skip: !process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL },
  async () => {
    const url = required(process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL);
    const target = new URL(url);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(target.hostname) &&
        target.pathname.endsWith("_test"),
    );
    process.env.POSTGRES_URL = url;
    const { db } = await import("@acme/db/client");
    const { eq } = await import("@acme/db");
    const {
      CaliforniaRoster: Roster,
      CaliforniaRaceWork: Work,
      CandidateResearchCollection: Collection,
      CandidateBriefRevision: Revision,
    } = await import("@acme/db/schema");
    const {
      saveResearchCollection,
      assertResearchWorkLease,
      failResearchRefresh,
    } = await import("./candidate-research-store");
    const snapshotId = createHash("sha256").update(randomUUID()).digest("hex");
    const key = randomUUID();
    const collection = fixture();
    collection.manifest.electionDate = "2099-11-03";
    required(collection.briefs[0]).identity.electionDate = "2099-11-03";
    collection.researchVersion = "lease-fixture-v1";
    collection.rosterSnapshotId = snapshotId;
    collection.rosterDigest = "c".repeat(64);
    collection.candidateArtifacts = [];
    const lease = { key, owner: "old-owner", generation: 1, reviewEpoch: 0 };
    let collectionId: string | undefined;
    try {
      await db.insert(Roster).values({
        id: snapshotId,
        electionDate: "2099-11-03",
        document: {} as never,
      });
      await db.insert(Work).values({
        key,
        snapshotId,
        raceKey: collection.pilotKey,
        rosterDigest: collection.rosterDigest,
        policyVersion: collection.manifest.policyVersion,
        researchVersion: collection.researchVersion,
        owner: lease.owner,
        status: "running",
        generation: 1,
        leaseUntil: new Date(Date.now() + 60_000),
      });
      collectionId = (
        await saveResearchCollection(collection, db, { workLease: lease })
      ).collectionId;
      await db
        .update(Work)
        .set({
          owner: "new-owner",
          generation: 2,
          leaseUntil: new Date(Date.now() + 60_000),
        })
        .where(eq(Work.key, key));
      await assert.rejects(
        saveResearchCollection(collection, db, { workLease: lease }),
        /expired or was superseded/,
      );
      await assert.rejects(
        db.transaction((tx) => assertResearchWorkLease(tx, lease, collection)),
        /expired or was superseded/,
      );
      await db.transaction((tx) =>
        assertResearchWorkLease(
          tx,
          { key, owner: "new-owner", generation: 2, reviewEpoch: 0 },
          collection,
        ),
      );
      await db
        .update(Work)
        .set({ researchVersion: "successor-config" })
        .where(eq(Work.key, key));
      await failResearchRefresh(
        collection.pilotKey,
        "Current source request failed under a successor configuration",
        db,
        {
          workLease: { key, owner: "new-owner", generation: 2, reviewEpoch: 0 },
        },
      );
      const [requiredFailure] = await db
        .select()
        .from(Work)
        .where(eq(Work.key, key));
      assert.ok(requiredFailure);
      assert.equal(requiredFailure.reviewEpoch, 1);
      await assert.rejects(
        failResearchRefresh(collection.pilotKey, "Stale worker failed", db, {
          workLease: lease,
        }),
        /expired or was superseded/,
      );
    } finally {
      if (collectionId)
        await db.delete(Collection).where(eq(Collection.id, collectionId));
      await db
        .delete(Revision)
        .where(eq(Revision.id, required(collection.briefs[0]).revisionId));
      await db.delete(Work).where(eq(Work.key, key));
      await db.delete(Roster).where(eq(Roster.id, snapshotId));
    }
  },
);

void test(
  "automated publication binds persisted dossiers and requires a fresh reviewer after failed-source recovery",
  { skip: !process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL },
  async () => {
    const url = required(process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL);
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
      CandidateBriefRevision: Revision,
      CandidateBriefReviewEvent: Event,
      CandidateResearchCollection: Collection,
      CandidateRaceRelease: Release,
      CandidateResearchPolicy: Policy,
    } = await import("@acme/db/schema");
    const { candidateEvidenceDossierSchema, californiaRosterSnapshotSchema } =
      await import("@acme/validators");
    const {
      saveResearchCollection,
      invalidateResearchElection,
      activeResearchPolicy,
    } = await import("./candidate-research-store");
    const {
      saveCaliforniaRoster,
      claimCaliforniaRaceWork,
      beginCaliforniaSourceCheck,
    } = await import("./california-roster-store");
    const {
      recordResearchAiReview,
      publishResearchCollection,
      adoptResearchPolicy,
    } = await import("./candidate-research-service");
    const hash = (value: unknown) =>
      createHash("sha256").update(JSON.stringify(value)).digest("hex");
    const document = fixture();
    const brief = required(document.briefs[0]);
    const source = required(document.sources[0]);
    const imageBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9kAAAAASUVORK5CYII=",
      "base64",
    );
    document.sources.push({
      id: "image-proof",
      url: "https://example.org/fixture.png",
      publisher: "Fixture",
      format: "image",
      text: "",
      contentHash: createHash("sha256").update("").digest("hex"),
      byteHash: createHash("sha256").update(imageBytes).digest("hex"),
      binaryBase64: imageBytes.toString("base64"),
      fetchedAt: source.fetchedAt,
    });
    const version = `ai-${randomUUID()}`;
    document.manifest.electionDate = "2097-11-03";
    brief.identity.electionDate = "2097-11-03";
    document.manifest.currentHashes = {
      [evidenceHashKey(brief.identity, "record")]: source.contentHash,
    };
    const snapshotId = hash(randomUUID()),
      rosterDigest = hash(randomUUID());
    const successorSnapshotId = hash(randomUUID());
    const pairSnapshotId = hash(randomUUID());
    const researchVersion = "ai-fixture-v1";
    brief.authorship = {
      kind: "generated",
      model: "author-model",
      promptVersion: "v1",
    };
    const finance = campaignFinanceSchema.parse({
      committeeId: "C00000001",
      committeeName: "Synthetic finance committee",
      periodStart: "2096-01-01",
      periodEnd: "2096-12-31",
      currency: "USD",
      coverage: "partial",
      coverageNote: "Synthetic typed finance fixture",
      updatedAt: brief.createdAt,
      filingEvidenceIds: ["finance"],
      receipts: {
        totalCents: 100,
        breakdown: {
          individuals: 100,
          committees: 0,
          self_contributions: 0,
          candidate_loans: 0,
          transfers: 0,
          other: 0,
        },
        refundsCents: null,
      },
      donors: [],
      donorCoverage: "unavailable",
      outsideSpending: null,
    });
    brief.research = {
      headlineClaimId: "record-claim",
      promises: [],
      finance,
      financeGap: null,
    };
    brief.evidence.push({ ...required(brief.evidence[0]), id: "finance" });
    document.manifest.currentHashes[
      evidenceHashKey(brief.identity, "finance")
    ] = source.contentHash;
    const selectedCampaignExcerpt = "I will build homes.";
    const attribution = {
      status: "unresolved" as const,
      context: {
        excerpt: "Alex Neighbor says: I will build homes.",
        locator: "Alex endorsement paragraph",
      },
    };
    const campaignText =
      "Fixture candidate's campaign publishes endorsements.\nAlex Neighbor says: I will build homes.\nJordan Other says: I will build homes.";
    const campaignSource = {
      id: "campaign-published",
      url: "https://campaign.example/endorsements",
      publisher: "Synthetic candidate campaign",
      format: "html" as const,
      text: campaignText,
      contentHash: createHash("sha256").update(campaignText).digest("hex"),
      fetchedAt: source.fetchedAt,
    };
    document.sources.push(campaignSource);
    brief.evidence.push({
      id: "campaign-passage",
      url: campaignSource.url,
      publisher: campaignSource.publisher,
      locator: "Endorsement excerpt",
      retrievedAt: campaignSource.fetchedAt,
      documentDate: null,
      contentHash: campaignSource.contentHash,
      excerpt: selectedCampaignExcerpt,
      origin: "candidate",
      attribution,
    });
    required(
      brief.sections.find((section) => section.topic === "unknowns"),
    ).claims.push({
      id: "campaign-context-claim",
      kind: "analysis",
      text: "This campaign-published excerpt has unresolved speaker attribution.",
      evidenceIds: ["campaign-passage"],
    });
    document.manifest.currentHashes[
      evidenceHashKey(brief.identity, "campaign-passage")
    ] = campaignSource.contentHash;
    document.rosterSnapshotId = snapshotId;
    document.rosterDigest = rosterDigest;
    document.researchVersion = researchVersion;
    document.manifest.policyVersion = version;
    const dossier = candidateEvidenceDossierSchema.parse({
      schemaVersion: 1,
      identity: brief.identity,
      name: "Fixture candidate",
      officeFamily: "us_house",
      officeKind: "federal_legislative",
      rosterDigest,
      researchVersion,
      createdAt: brief.createdAt,
      finance,
      sources: document.sources,
      evidence: [
        {
          id: "record",
          sourceId: "record",
          excerpt: source.text,
          locator: "Fixture",
          origin: "primary_record",
          role: "candidate_record",
          identityQualification: "exact_election_office",
        },
        {
          id: "finance",
          sourceId: "record",
          excerpt: source.text,
          locator: "Synthetic filing",
          origin: "primary_record",
          role: "finance",
          identityQualification: "exact_election_office",
        },
        {
          id: "campaign-passage",
          sourceId: campaignSource.id,
          excerpt: selectedCampaignExcerpt,
          locator: "Endorsement excerpt",
          origin: "candidate",
          role: "campaign_material",
          identityQualification: "exact_election_office",
          attribution,
        },
      ],
      gaps: [],
      classification: "supported",
      sourceSetDigest: hash(candidateDossierSourceProjection(document.sources)),
      dossierDigest: "0".repeat(64),
    });
    dossier.dossierDigest = hash(candidateDossierSemanticProjection(dossier));
    const author = {
      role: "author",
      actorId: brief.authorId,
      runId: randomUUID(),
      configuredModel: "author-model",
      actualModel: "author-model",
      provider: "fixture",
      requestId: null,
      promptVersion: "v1",
      policyVersion: version,
      sourceSetDigest: dossier.sourceSetDigest,
      dossierDigest: dossier.dossierDigest,
      revisionDigest: briefDigest(brief),
      startedAt: brief.createdAt,
      completedAt: brief.createdAt,
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: null,
    };
    const reviewer = {
      ...author,
      role: "reviewer",
      actorId: "fixture-reviewer",
      runId: randomUUID(),
      configuredModel: "review-model",
      actualModel: "review-model",
    };
    const attestation = {
      author,
      reviewer,
      verdict: "approve",
      findings: [
        {
          claimId: "record-claim",
          supported: true,
          reason: "Exact primary record excerpt.",
        },
        {
          claimId: "campaign-context-claim",
          supported: true,
          reason:
            "The archived campaign paragraph has explicit unresolved attribution metadata.",
        },
      ],
    };
    document.candidateArtifacts = [
      {
        candidateId: brief.identity.candidateId,
        dossierDigest: dossier.dossierDigest,
        sourceSetDigest: dossier.sourceSetDigest,
        author,
        dossier,
      },
    ];
    const snapshot = californiaRosterSnapshotSchema.parse({
      schemaVersion: 1,
      id: snapshotId,
      electionDate: "2097-11-03",
      scope: "ca_sos_certified",
      scopeLabel: "Synthetic fixture",
      source: {
        url: source.url,
        byteHash: source.contentHash,
        textHash: source.contentHash,
        fetchedAt: source.fetchedAt,
        encoding: "windows-1252",
        text: source.text,
      },
      certification: {
        url: source.url,
        textHash: source.contentHash,
        fetchedAt: source.fetchedAt,
        text: source.text,
      },
      races: [
        {
          raceKey: document.pilotKey,
          contestId: brief.identity.contestId,
          jurisdiction: brief.identity.jurisdiction,
          jurisdictionLabel: "Fixture",
          electionDate: brief.identity.electionDate,
          sourceContestId: "fixture",
          officeFamily: "us_house",
          office: "Mayor",
          district: null,
          kind: "election",
          rosterDigest,
          members: [
            {
              identity: brief.identity,
              candidateId: brief.identity.candidateId,
              name: "Fixture candidate",
              sourceCandidateId: "official-fixture",
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
    const collectionIds: string[] = [],
      releaseIds: string[] = [],
      revisionIds = [brief.revisionId];
    let lease:
      | { key: string; owner: string; generation: number; reviewEpoch: number }
      | undefined;
    try {
      await adoptResearchPolicy({
        policy: {
          version,
          approvedBy: "fixture-owner",
          statement:
            "This synthetic automation policy explicitly authorizes a service actor and independently invoked model reviews for the local test only.",
          automation: {
            serviceActorId: "fixture-service",
            allowedAuthorModels: ["author-model"],
            allowedReviewerModels: ["review-model"],
            researchVersion,
          },
        },
        collectionIds: [],
      });
      await saveCaliforniaRoster(db, snapshot);
      const sourceEpoch = await beginCaliforniaSourceCheck(
        db,
        document.manifest.electionDate,
      );
      assert.ok(sourceEpoch);
      const claim = await claimCaliforniaRaceWork(db, {
        expectedSourceEpoch: sourceEpoch,
        snapshotId,
        raceKey: document.pilotKey,
        rosterDigest,
        policyVersion: version,
        researchVersion,
        owner: "fixture-worker",
      });
      assert.ok(claim);
      lease = {
        key: claim.key,
        owner: claim.owner,
        generation: claim.generation,
        reviewEpoch: claim.reviewEpoch,
      };
      const saved = await saveResearchCollection(document, db, {
        workLease: lease,
      });
      collectionIds.push(saved.collectionId);
      const initialReview = await recordResearchAiReview({
        collectionId: saved.collectionId,
        revisionId: brief.revisionId,
        attestation,
        workLease: lease,
      });
      releaseIds.push(
        (
          await publishResearchCollection({
            collectionId: saved.collectionId,
            actorId: "fixture-service",
            workLease: lease,
          })
        ).releaseId,
      );
      assert.equal(
        (
          await publishResearchCollection({
            collectionId: saved.collectionId,
            actorId: "fixture-service",
            workLease: lease,
          })
        ).releaseId,
        required(releaseIds[0]),
        "Publishing the identical approved collection twice retains its release ID after JSONB round-trip",
      );
      const lateLegacy = structuredClone(document);
      delete lateLegacy.candidateArtifacts;
      delete lateLegacy.researchVersion;
      delete lateLegacy.rosterSnapshotId;
      delete lateLegacy.rosterDigest;
      const beforeLateLegacy = await db
        .select()
        .from(Collection)
        .where(eq(Collection.pilotKey, document.pilotKey));
      const beforeLateRelease = await db
        .select()
        .from(Release)
        .where(eq(Release.id, required(releaseIds[0])));
      await assert.rejects(
        saveResearchCollection(lateLegacy, db),
        /automation policy does not accept legacy/,
      );
      assert.deepEqual(
        await db
          .select()
          .from(Collection)
          .where(eq(Collection.pilotKey, document.pilotKey)),
        beforeLateLegacy,
      );
      assert.deepEqual(
        await db
          .select()
          .from(Release)
          .where(eq(Release.id, required(releaseIds[0]))),
        beforeLateRelease,
      );
      const expiredCheckedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const [initialRelease] = await db
        .select()
        .from(Release)
        .where(eq(Release.id, required(releaseIds[0])));
      assert.ok(initialRelease);
      const expiredManifest = {
        ...initialRelease.document,
        sourceCheckedAt: expiredCheckedAt.toISOString(),
        expiresAt: new Date(
          expiredCheckedAt.getTime() + 86_400_000,
        ).toISOString(),
      };
      await db
        .update(Collection)
        .set({ checkedAt: expiredCheckedAt })
        .where(eq(Collection.id, saved.collectionId));
      await db
        .update(Release)
        .set({ document: expiredManifest })
        .where(eq(Release.id, initialRelease.id));
      const observedDocument = structuredClone(document);
      const observationTime = new Date().toISOString();
      const observedDossier = candidateEvidenceDossierSchema.parse({
        ...dossier,
        createdAt: observationTime,
        finance: { ...finance, updatedAt: observationTime },
        sources: dossier.sources.map((entry) => ({
          ...entry,
          fetchedAt: observationTime,
          ...(entry.format !== "image"
            ? {
                byteHash: createHash("sha256")
                  .update("changed raw text response metadata")
                  .digest("hex"),
              }
            : {}),
        })),
      });
      assert.equal(
        hash(candidateDossierSemanticProjection(observedDossier)),
        dossier.dossierDigest,
      );
      assert.equal(
        hash(candidateDossierSourceProjection(observedDossier.sources)),
        dossier.sourceSetDigest,
      );
      required(observedDocument.candidateArtifacts?.[0]).dossier =
        observedDossier;
      observedDocument.sources = observedDocument.sources.map((entry) => ({
        ...entry,
        fetchedAt: observationTime,
        ...(entry.format !== "image"
          ? {
              byteHash: createHash("sha256")
                .update("changed raw text response metadata")
                .digest("hex"),
            }
          : {}),
      }));
      observedDocument.manifest.sourceCheckedAt = observationTime;
      observedDocument.manifest.rosterVerifiedAt = observationTime;
      observedDocument.manifest.expiresAt = new Date(
        Date.parse(observationTime) + 86_400_000,
      ).toISOString();
      const unchanged = await saveResearchCollection(observedDocument, db, {
        workLease: lease,
      });
      assert.equal(unchanged.changed, false);
      assert.equal(unchanged.collectionId, saved.collectionId);
      const [renewedRelease] = await db
        .select()
        .from(Release)
        .where(eq(Release.id, initialRelease.id));
      assert.ok(renewedRelease);
      assert.equal(renewedRelease.document.sourceCheckedAt, observationTime);
      assert.equal(
        renewedRelease.document.expiresAt,
        new Date(Date.parse(observationTime) + 86_400_000).toISOString(),
      );
      await db
        .update(Release)
        .set({ document: expiredManifest })
        .where(eq(Release.id, initialRelease.id));

      const reusedReview = await recordResearchAiReview({
        collectionId: unchanged.collectionId,
        revisionId: brief.revisionId,
        attestation,
        workLease: lease,
      });
      assert.equal(reusedReview.eventId, initialReview.eventId);
      assert.equal(
        (
          await publishResearchCollection({
            collectionId: unchanged.collectionId,
            actorId: "fixture-service",
            workLease: lease,
          })
        ).releaseId,
        required(releaseIds[0]),
      );
      const [idempotentlyRenewed] = await db
        .select()
        .from(Release)
        .where(eq(Release.id, initialRelease.id));
      assert.ok(idempotentlyRenewed);
      assert.equal(
        idempotentlyRenewed.document.sourceCheckedAt,
        observationTime,
      );
      assert.equal(
        idempotentlyRenewed.document.expiresAt,
        new Date(Date.parse(observationTime) + 86_400_000).toISOString(),
      );
      const [storedRelease] = await db
        .select()
        .from(Release)
        .where(eq(Release.id, required(releaseIds[0])));
      assert.ok(storedRelease);
      const storedRevisions = await db
        .select()
        .from(Revision)
        .where(eq(Revision.id, brief.revisionId));
      const storedEvents = await db
        .select()
        .from(Event)
        .where(eq(Event.revisionId, brief.revisionId));
      const storedPolicy = await activeResearchPolicy(db);
      assert.ok(storedPolicy.automation);
      const storedInput = {
        manifest: storedRelease.document,
        revokedReason: storedRelease.revokedReason,
        revisions: storedRevisions,
        events: storedEvents,
        policy: storedPolicy,
        now: new Date().toISOString(),
      };
      assert.equal(
        readCandidateRace(storedInput),
        null,
        "Persisted automation policy never substitutes its manifest for the missing current roster",
      );
      assert.ok(
        readCandidateRace({
          ...storedInput,
          currentRoster: {
            snapshotId,
            rosterDigest,
            candidateIds: [brief.identity.candidateId],
            contestId: brief.identity.contestId,
            jurisdiction: brief.identity.jurisdiction,
            electionDate: brief.identity.electionDate,
          },
        }),
      );
      await saveCaliforniaRoster(
        db,
        { ...snapshot, id: successorSnapshotId },
        { expectedSourceEpoch: sourceEpoch },
      );
      const successorEpoch = await beginCaliforniaSourceCheck(
        db,
        snapshot.electionDate,
      );
      assert.ok(successorEpoch);
      await saveCaliforniaRoster(db, snapshot, {
        expectedSourceEpoch: successorEpoch,
      });
      const [priorRelease] = await db
        .select()
        .from(Release)
        .where(eq(Release.id, required(releaseIds[0])));
      assert.ok(priorRelease?.revokedReason);
      await assert.rejects(
        publishResearchCollection({
          collectionId: saved.collectionId,
          actorId: "fixture-service",
          workLease: lease,
        }),
        /expired or was superseded/,
      );
      let resumeReview: () => void = () => {
        throw new Error("Missing model wait resolver");
      };
      const waitingForModel = new Promise<void>((resolve) => {
        resumeReview = resolve;
      });
      const delayedReview = waitingForModel.then(() =>
        recordResearchAiReview({
          collectionId: saved.collectionId,
          revisionId: brief.revisionId,
          attestation,
          workLease: lease,
        }),
      );
      const invalidated = await invalidateResearchElection({
        electionDate: document.manifest.electionDate,
        snapshotId,
        reason: "Required shared roster source failed",
      });
      assert.equal(invalidated.releases, 1);
      resumeReview();
      await assert.rejects(delayedReview, /expired or was superseded/);
      await assert.rejects(
        publishResearchCollection({
          collectionId: saved.collectionId,
          actorId: "fixture-service",
          workLease: lease,
        }),
        /expired or was superseded/,
      );
      await assert.rejects(
        saveResearchCollection(document, db, { workLease: lease }),
        /expired or was superseded/,
      );
      await assert.rejects(
        claimCaliforniaRaceWork(db, {
          snapshotId,
          raceKey: document.pilotKey,
          rosterDigest,
          policyVersion: version,
          researchVersion,
          owner: "stale-shared-fetch",
          expectedSourceEpoch: sourceEpoch,
        }),
        /Shared source check was superseded/,
      );
      const freshEpoch = await beginCaliforniaSourceCheck(
        db,
        document.manifest.electionDate,
      );
      assert.ok(freshEpoch);
      const resumed = await claimCaliforniaRaceWork(db, {
        expectedSourceEpoch: freshEpoch,
        snapshotId,
        raceKey: document.pilotKey,
        rosterDigest,
        policyVersion: version,
        researchVersion,
        owner: "fixture-worker-recovered",
      });
      assert.ok(resumed);
      lease = {
        key: resumed.key,
        owner: resumed.owner,
        generation: resumed.generation,
        reviewEpoch: resumed.reviewEpoch,
      };
      const recovered = await saveResearchCollection(observedDocument, db, {
        workLease: lease,
      });
      collectionIds.push(recovered.collectionId);
      await assert.rejects(
        recordResearchAiReview({
          collectionId: recovered.collectionId,
          revisionId: brief.revisionId,
          attestation,
          workLease: lease,
        }),
        /reviewer invocation cannot approve/,
      );
      await assert.rejects(
        publishResearchCollection({
          collectionId: recovered.collectionId,
          actorId: "fixture-service",
          workLease: lease,
        }),
        /independent approval/,
      );
      await recordResearchAiReview({
        collectionId: recovered.collectionId,
        revisionId: brief.revisionId,
        attestation: {
          ...attestation,
          reviewer: { ...reviewer, runId: randomUUID() },
        },
        workLease: lease,
      });
      releaseIds.push(
        (
          await publishResearchCollection({
            collectionId: recovered.collectionId,
            actorId: "fixture-service",
            workLease: lease,
          })
        ).releaseId,
      );
      const changedFinance = structuredClone(observedDocument);
      const changedDossier = candidateEvidenceDossierSchema.parse(
        required(changedFinance.candidateArtifacts?.[0]).dossier,
      );
      assert.ok(changedDossier.finance?.receipts);
      changedDossier.finance.receipts.totalCents = 200;
      changedDossier.finance.receipts.breakdown.individuals = 200;
      changedDossier.dossierDigest = hash(
        candidateDossierSemanticProjection(changedDossier),
      );
      const changedArtifact = required(changedFinance.candidateArtifacts?.[0]);
      changedArtifact.dossier = changedDossier;
      changedArtifact.dossierDigest = changedDossier.dossierDigest;
      const changedSaved = await saveResearchCollection(changedFinance, db, {
        workLease: lease,
      });
      collectionIds.push(changedSaved.collectionId);
      await assert.rejects(
        recordResearchAiReview({
          collectionId: changedSaved.collectionId,
          revisionId: brief.revisionId,
          attestation: {
            ...attestation,
            reviewer: { ...reviewer, runId: randomUUID() },
          },
          workLease: lease,
        }),
        /Dossier evidence does not support/,
      );
      const changedImage = structuredClone(observedDocument);
      const imageArchive = required(
        changedImage.sources.find((entry) => entry.format === "image"),
      );
      const changedBytes = Buffer.concat([imageBytes, Buffer.from([0])]);
      imageArchive.binaryBase64 = changedBytes.toString("base64");
      imageArchive.byteHash = createHash("sha256")
        .update(changedBytes)
        .digest("hex");
      const imageDossier = candidateEvidenceDossierSchema.parse(
        required(changedImage.candidateArtifacts?.[0]).dossier,
      );
      imageDossier.sources = changedImage.sources;
      imageDossier.sourceSetDigest = hash(
        candidateDossierSourceProjection(imageDossier.sources),
      );
      imageDossier.dossierDigest = hash(
        candidateDossierSemanticProjection(imageDossier),
      );
      const imageArtifact = required(changedImage.candidateArtifacts?.[0]);
      imageArtifact.dossier = imageDossier;
      imageArtifact.dossierDigest = imageDossier.dossierDigest;
      imageArtifact.sourceSetDigest = imageDossier.sourceSetDigest;
      const imageChanged = await saveResearchCollection(changedImage, db, {
        workLease: lease,
      });
      collectionIds.push(imageChanged.collectionId);
      assert.equal(imageChanged.changed, true);
      await assert.rejects(
        recordResearchAiReview({
          collectionId: imageChanged.collectionId,
          revisionId: brief.revisionId,
          attestation: {
            ...attestation,
            reviewer: { ...reviewer, runId: randomUUID() },
          },
          workLease: lease,
        }),
        /Independent review is not bound/,
      );
      const changedSource = structuredClone(observedDocument);
      const changedArchive = required(changedSource.sources[0]);
      changedArchive.text += " Changed filing amount.";
      changedArchive.contentHash = createHash("sha256")
        .update(changedArchive.text)
        .digest("hex");
      const hashDossier = candidateEvidenceDossierSchema.parse(
        required(changedSource.candidateArtifacts?.[0]).dossier,
      );
      hashDossier.sources = [changedArchive];
      hashDossier.sourceSetDigest = hash(
        candidateDossierSourceProjection(hashDossier.sources),
      );
      hashDossier.dossierDigest = hash(
        candidateDossierSemanticProjection(hashDossier),
      );
      const hashArtifact = required(changedSource.candidateArtifacts?.[0]);
      hashArtifact.dossier = hashDossier;
      hashArtifact.dossierDigest = hashDossier.dossierDigest;
      hashArtifact.sourceSetDigest = hashDossier.sourceSetDigest;
      await assert.rejects(
        saveResearchCollection(changedSource, db, { workLease: lease }),
        /same hash|Official roster/,
      );
      const attributionEdits = [
        { label: "stripped", value: undefined },
        {
          label: "truncated",
          value: {
            ...attribution,
            context: {
              ...attribution.context,
              excerpt: selectedCampaignExcerpt,
            },
          },
        },
        {
          label: "another candidate context",
          value: {
            ...attribution,
            context: {
              excerpt: "Jordan Other says: I will build homes.",
              locator: "Jordan endorsement paragraph",
            },
          },
        },
        {
          label: "unverified official attribution",
          value: {
            ...attribution,
            status: "official_candidate_statement" as const,
          },
        },
      ];
      for (const edit of attributionEdits) {
        const changed = structuredClone(observedDocument),
          changedBrief = required(changed.briefs[0]);
        changedBrief.revisionId = randomUUID();
        changedBrief.authorId = `changed-author:${randomUUID()}`;
        revisionIds.push(changedBrief.revisionId);
        required(
          changedBrief.evidence.find(
            (entry) => entry.id === "campaign-passage",
          ),
        ).attribution = edit.value;
        required(changed.manifest.members[0]).revisionId =
          changedBrief.revisionId;
        const changedAuthor = {
          ...author,
          actorId: changedBrief.authorId,
          runId: randomUUID(),
          revisionDigest: briefDigest(changedBrief),
        };
        required(changed.candidateArtifacts?.[0]).author = changedAuthor;
        const changedSaved = await saveResearchCollection(changed, db, {
          workLease: lease,
        });
        collectionIds.push(changedSaved.collectionId);
        await assert.rejects(
          recordResearchAiReview({
            collectionId: changedSaved.collectionId,
            revisionId: changedBrief.revisionId,
            attestation: {
              ...attestation,
              author: changedAuthor,
              reviewer: {
                ...reviewer,
                actorId: `changed-reviewer:${randomUUID()}`,
                runId: randomUUID(),
                revisionDigest: briefDigest(changedBrief),
              },
            },
            workLease: lease,
          }),
          /Dossier evidence does not support/,
          `Campaign attribution ${edit.label} cannot replace the selected immutable metadata`,
        );
      }
      const gapOnly = structuredClone(observedDocument),
        gapBrief = required(gapOnly.briefs[0]);
      gapBrief.revisionId = randomUUID();
      gapBrief.authorId = `gap-author:${randomUUID()}`;
      revisionIds.push(gapBrief.revisionId);
      required(gapOnly.manifest.members[0]).revisionId = gapBrief.revisionId;
      const recordSection = required(
        gapBrief.sections.find((section) => section.topic === "record"),
      );
      required(
        gapBrief.sections.find((section) => section.topic === "unknowns"),
      ).claims.push(...recordSection.claims);
      recordSection.claims = [];
      const gapAuthor = {
        ...author,
        actorId: gapBrief.authorId,
        runId: randomUUID(),
        revisionDigest: briefDigest(gapBrief),
      };
      required(gapOnly.candidateArtifacts?.[0]).author = gapAuthor;
      const gapSaved = await saveResearchCollection(gapOnly, db, {
        workLease: lease,
      });
      collectionIds.push(gapSaved.collectionId);
      await assert.rejects(
        recordResearchAiReview({
          collectionId: gapSaved.collectionId,
          revisionId: gapBrief.revisionId,
          workLease: lease,
          attestation: {
            ...attestation,
            author: gapAuthor,
            reviewer: {
              ...reviewer,
              runId: randomUUID(),
              revisionDigest: briefDigest(gapBrief),
            },
          },
        }),
        /requires substantive/,
      );
      await assert.rejects(
        publishResearchCollection({
          collectionId: gapSaved.collectionId,
          actorId: "fixture-service",
          workLease: lease,
        }),
        /requires substantive/,
      );
      const forgedContext = structuredClone(observedDocument),
        forgedBrief = required(forgedContext.briefs[0]);
      forgedBrief.revisionId = randomUUID();
      forgedBrief.authorId = `forged-context-author:${randomUUID()}`;
      revisionIds.push(forgedBrief.revisionId);
      required(forgedContext.manifest.members[0]).revisionId =
        forgedBrief.revisionId;
      const forgedAttribution = {
        ...attribution,
        context: {
          excerpt: "Invented Speaker says: I will build homes.",
          locator: "Invented paragraph",
        },
      };
      required(
        forgedBrief.evidence.find((entry) => entry.id === "campaign-passage"),
      ).attribution = forgedAttribution;
      const forgedDossier = candidateEvidenceDossierSchema.parse(
        required(forgedContext.candidateArtifacts?.[0]).dossier,
      );
      required(
        forgedDossier.evidence.find((entry) => entry.id === "campaign-passage"),
      ).attribution = forgedAttribution;
      forgedDossier.dossierDigest = hash(
        candidateDossierSemanticProjection(forgedDossier),
      );
      const forgedAuthor = {
        ...author,
        actorId: forgedBrief.authorId,
        runId: randomUUID(),
        revisionDigest: briefDigest(forgedBrief),
        dossierDigest: forgedDossier.dossierDigest,
      };
      const forgedArtifact = required(forgedContext.candidateArtifacts?.[0]);
      forgedArtifact.dossier = forgedDossier;
      forgedArtifact.dossierDigest = forgedDossier.dossierDigest;
      forgedArtifact.author = forgedAuthor;
      const forgedSaved = await saveResearchCollection(forgedContext, db, {
        workLease: lease,
      });
      collectionIds.push(forgedSaved.collectionId);
      await assert.rejects(
        recordResearchAiReview({
          collectionId: forgedSaved.collectionId,
          revisionId: forgedBrief.revisionId,
          attestation: {
            ...attestation,
            author: forgedAuthor,
            reviewer: {
              ...reviewer,
              runId: randomUUID(),
              revisionDigest: briefDigest(forgedBrief),
              dossierDigest: forgedDossier.dossierDigest,
            },
          },
          workLease: lease,
        }),
        /Speaker context must be a full exact archived passage/,
      );

      const pairKey = randomUUID();
      const pairRosterDigest = hash(randomUUID());
      const pairElectionDate = "2098-11-03";
      const pairDocument = structuredClone(document);
      pairDocument.pilotKey = pairKey;
      pairDocument.rosterSnapshotId = pairSnapshotId;
      pairDocument.rosterDigest = pairRosterDigest;
      pairDocument.sources = [source];
      const pairBriefs = ["first", "second"].map((suffix) => {
        const selected = structuredClone(brief);
        selected.identity = {
          candidateId: `${pairKey}:${suffix}`,
          contestId: pairKey,
          jurisdiction: `fixture:${pairKey}`,
          electionDate: pairElectionDate,
        };
        selected.revisionId = randomUUID();
        selected.authorId = `pair-author:${randomUUID()}`;
        delete selected.research;
        selected.evidence = selected.evidence.filter(
          (entry) => entry.id === "record",
        );
        for (const section of selected.sections)
          if (section.topic !== "record") section.claims = [];
        revisionIds.push(selected.revisionId);
        return selected;
      });
      pairDocument.briefs = pairBriefs;
      pairDocument.manifest.contestId = pairKey;
      pairDocument.manifest.jurisdiction = `fixture:${pairKey}`;
      pairDocument.manifest.electionDate = pairElectionDate;
      pairDocument.manifest.members = pairBriefs.map((selected, index) => ({
        candidateId: selected.identity.candidateId,
        revisionId: selected.revisionId,
        name: `Fixture candidate ${index + 1}`,
        description: null,
        ballotStatus: "on_ballot" as const,
      }));
      pairDocument.manifest.currentHashes = Object.fromEntries(
        pairBriefs.map((selected) => [
          evidenceHashKey(selected.identity, "record"),
          source.contentHash,
        ]),
      );
      pairDocument.candidateArtifacts = pairBriefs.map((selected, index) => {
        const selectedDossier = candidateEvidenceDossierSchema.parse({
          ...dossier,
          identity: selected.identity,
          name: `Fixture candidate ${index + 1}`,
          rosterDigest: pairRosterDigest,
          finance: null,
          sources: [source],
          evidence: dossier.evidence.filter((entry) => entry.id === "record"),
          sourceSetDigest: hash(candidateDossierSourceProjection([source])),
          dossierDigest: "0".repeat(64),
        });
        selectedDossier.dossierDigest = hash(
          candidateDossierSemanticProjection(selectedDossier),
        );
        const selectedAuthor = {
          ...author,
          actorId: selected.authorId,
          runId: randomUUID(),
          requestId: `pair-author-request:${randomUUID()}`,
          revisionDigest: briefDigest(selected),
          dossierDigest: selectedDossier.dossierDigest,
          sourceSetDigest: selectedDossier.sourceSetDigest,
        };
        return {
          candidateId: selected.identity.candidateId,
          dossierDigest: selectedDossier.dossierDigest,
          sourceSetDigest: selectedDossier.sourceSetDigest,
          author: selectedAuthor,
          dossier: selectedDossier,
        };
      });
      const pairSnapshot = californiaRosterSnapshotSchema.parse({
        ...snapshot,
        id: pairSnapshotId,
        electionDate: pairElectionDate,
        races: [
          {
            ...required(snapshot.races[0]),
            raceKey: pairKey,
            contestId: pairKey,
            jurisdiction: `fixture:${pairKey}`,
            electionDate: pairElectionDate,
            rosterDigest: pairRosterDigest,
            members: pairBriefs.map((selected, index) => ({
              identity: selected.identity,
              candidateId: selected.identity.candidateId,
              name: `Fixture candidate ${index + 1}`,
              sourceCandidateId: `pair-official-${index}`,
              partyCode: "",
              party: null,
              ballotStatus: "on_ballot",
            })),
          },
        ],
      });
      await saveCaliforniaRoster(db, pairSnapshot);
      const pairEpoch = await beginCaliforniaSourceCheck(db, pairElectionDate);
      assert.ok(pairEpoch);
      const pairLease = await claimCaliforniaRaceWork(db, {
        expectedSourceEpoch: pairEpoch,
        snapshotId: pairSnapshotId,
        raceKey: pairKey,
        rosterDigest: pairRosterDigest,
        policyVersion: version,
        researchVersion,
        owner: "pair-fixture-worker",
      });
      assert.ok(pairLease);
      const pairReviews = required(pairDocument.candidateArtifacts).map(
        (artifact) => ({
          author: artifact.author,
          reviewer: {
            ...candidateModelAttestationSchema.parse(artifact.author),
            role: "reviewer" as const,
            actorId: `pair-reviewer:${randomUUID()}`,
            runId: randomUUID(),
            requestId: `pair-review-request:${randomUUID()}`,
            configuredModel: "review-model",
            actualModel: "review-model",
          },
          verdict: "approve" as const,
          findings: [
            {
              claimId: "record-claim",
              supported: true,
              reason: "Exact synthetic primary record.",
            },
          ],
        }),
      );
      const pairFirst = await saveResearchCollection(pairDocument, db, {
        workLease: pairLease,
      });
      collectionIds.push(pairFirst.collectionId);
      for (const [index, selected] of pairBriefs.entries())
        await recordResearchAiReview({
          collectionId: pairFirst.collectionId,
          revisionId: selected.revisionId,
          attestation: pairReviews[index],
          workLease: pairLease,
        });
      releaseIds.push(
        (
          await publishResearchCollection({
            collectionId: pairFirst.collectionId,
            actorId: "fixture-service",
            workLease: pairLease,
          })
        ).releaseId,
      );
      const pairChanged = structuredClone(pairDocument);
      const changedPairBrief = required(pairChanged.briefs[0]);
      changedPairBrief.revisionId = randomUUID();
      changedPairBrief.authorId = `pair-changed-author:${randomUUID()}`;
      revisionIds.push(changedPairBrief.revisionId);
      required(pairChanged.manifest.members[0]).revisionId =
        changedPairBrief.revisionId;
      const changedPairArtifacts = required(pairChanged.candidateArtifacts);
      const changedPairAuthor = {
        ...candidateModelAttestationSchema.parse(
          required(changedPairArtifacts[0]).author,
        ),
        actorId: changedPairBrief.authorId,
        runId: randomUUID(),
        requestId: `pair-changed-author-request:${randomUUID()}`,
        revisionDigest: briefDigest(changedPairBrief),
      };
      required(changedPairArtifacts[0]).author = changedPairAuthor;
      assert.deepEqual(pairChanged.briefs[1], pairDocument.briefs[1]);
      assert.deepEqual(
        changedPairArtifacts[1],
        pairDocument.candidateArtifacts[1],
      );
      const pairNext = await saveResearchCollection(pairChanged, db, {
        workLease: pairLease,
      });
      collectionIds.push(pairNext.collectionId);
      assert.equal(pairNext.changed, true);
      assert.notEqual(pairNext.collectionId, pairFirst.collectionId);
      const changedPairReview = {
        ...required(pairReviews[0]),
        author: changedPairAuthor,
        reviewer: {
          ...required(pairReviews[0]).reviewer,
          actorId: `pair-changed-reviewer:${randomUUID()}`,
          runId: randomUUID(),
          requestId: `pair-changed-review-request:${randomUUID()}`,
          revisionDigest: briefDigest(changedPairBrief),
        },
      };
      const partialReview = await recordResearchAiReview({
        collectionId: pairNext.collectionId,
        revisionId: changedPairBrief.revisionId,
        attestation: changedPairReview,
        workLease: pairLease,
      });
      const unchangedPairBrief = required(pairChanged.briefs[1]);
      const unchangedPairReview = required(pairReviews[1]);
      await assert.rejects(
        recordResearchAiReview({
          collectionId: pairNext.collectionId,
          revisionId: unchangedPairBrief.revisionId,
          attestation: unchangedPairReview,
          workLease: pairLease,
        }),
        (error: unknown) => {
          assert.ok(error instanceof ResearchReviewCollectionConflict);
          assert.equal(error.collectionId, pairNext.collectionId);
          assert.equal(error.revisionId, unchangedPairBrief.revisionId);
          assert.equal(error.reviewerRunId, unchangedPairReview.reviewer.runId);
          return true;
        },
      );
      const pairResumed = await saveResearchCollection(
        structuredClone(pairChanged),
        db,
        { workLease: pairLease },
      );
      assert.equal(pairResumed.changed, false);
      assert.equal(pairResumed.collectionId, pairNext.collectionId);
      assert.equal(
        (
          await recordResearchAiReview({
            collectionId: pairResumed.collectionId,
            revisionId: changedPairBrief.revisionId,
            attestation: changedPairReview,
            workLease: pairLease,
          })
        ).eventId,
        partialReview.eventId,
      );
      const freshPairReview = {
        ...unchangedPairReview,
        reviewer: {
          ...unchangedPairReview.reviewer,
          actorId: `pair-fresh-reviewer:${randomUUID()}`,
          runId: randomUUID(),
          requestId: `pair-fresh-review-request:${randomUUID()}`,
        },
      };
      const freshPairEvent = await recordResearchAiReview({
        collectionId: pairResumed.collectionId,
        revisionId: unchangedPairBrief.revisionId,
        attestation: freshPairReview,
        workLease: pairLease,
      });
      assert.equal(
        (
          await recordResearchAiReview({
            collectionId: pairResumed.collectionId,
            revisionId: unchangedPairBrief.revisionId,
            attestation: freshPairReview,
            workLease: pairLease,
          })
        ).eventId,
        freshPairEvent.eventId,
      );
      releaseIds.push(
        (
          await publishResearchCollection({
            collectionId: pairResumed.collectionId,
            actorId: "fixture-service",
            workLease: pairLease,
          })
        ).releaseId,
      );
      await assert.rejects(
        recordResearchAiReview({
          collectionId: pairResumed.collectionId,
          revisionId: unchangedPairBrief.revisionId,
          attestation: unchangedPairReview,
          workLease: pairLease,
        }),
        ResearchReviewCollectionConflict,
      );
    } finally {
      if (releaseIds.length)
        await db.delete(Release).where(inArray(Release.id, releaseIds));
      await db.delete(Event).where(inArray(Event.revisionId, revisionIds));
      if (collectionIds.length)
        await db
          .delete(Collection)
          .where(inArray(Collection.id, collectionIds));
      await db.delete(Revision).where(inArray(Revision.id, revisionIds));
      await db.delete(Work).where(eq(Work.snapshotId, snapshotId));
      await db
        .delete(Work)
        .where(eq(Work.key, `source-epoch:${snapshot.electionDate}`));
      await db.delete(Roster).where(eq(Roster.id, snapshotId));
      await db.delete(Roster).where(eq(Roster.id, successorSnapshotId));
      await db.delete(Work).where(eq(Work.snapshotId, pairSnapshotId));
      await db.delete(Work).where(eq(Work.key, "source-epoch:2098-11-03"));
      await db.delete(Roster).where(eq(Roster.id, pairSnapshotId));
      await db.delete(Policy).where(eq(Policy.version, version));
    }
  },
);

void test(
  "automated policy cutover requires prepared replacements for every currently public race",
  { skip: !process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL },
  async () => {
    const url = required(process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL);
    const target = new URL(url);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(target.hostname) &&
        target.pathname.endsWith("_test"),
    );
    process.env.POSTGRES_URL = url;
    const { db } = await import("@acme/db/client");
    const { eq, inArray, sql } = await import("@acme/db");
    const {
      CaliforniaRoster: Roster,
      CaliforniaRaceWork: Work,
      CandidateBriefRevision: Revision,
      CandidateBriefReviewEvent: Event,
      CandidateResearchCollection: Collection,
      CandidateRaceRelease: Release,
      CandidateResearchPolicy: Policy,
    } = await import("@acme/db/schema");
    const { candidateEvidenceDossierSchema, californiaRosterSnapshotSchema } =
      await import("@acme/validators");
    const {
      saveCaliforniaRoster,
      beginCaliforniaSourceCheck,
      claimCaliforniaRaceWork,
    } = await import("./california-roster-store");
    const {
      saveResearchCollection,
      activeResearchPolicy,
      resolveCurrentResearchRoster,
      lockPilot,
    } = await import("./candidate-research-store");
    const {
      adoptResearchPolicy,
      recordResearchAiReview,
      publishResearchCollection,
    } = await import("./candidate-research-service");
    const hash = (value: unknown) =>
      createHash("sha256").update(JSON.stringify(value)).digest("hex");
    const snapshotId = hash(randomUUID()),
      electionDate = "2095-11-03",
      researchVersion = "auto-policy-fixture-v1";
    const v1 = `auto-v1-${randomUUID()}`,
      v2 = `auto-v2-${randomUUID()}`;
    const automation = {
      serviceActorId: "policy-fixture-service",
      allowedAuthorModels: ["author-model"],
      allowedReviewerModels: ["review-model"],
      researchVersion,
    };
    const policy = (version: string) => ({
      version,
      approvedBy: "fixture-owner",
      statement:
        "This synthetic automation policy authorizes independent fixture model reviews and service publication only inside the disposable local test database.",
      automation,
    });
    function prepared(key: string, version: string) {
      const document = fixture(key),
        brief = required(document.briefs[0]),
        source = required(document.sources[0]),
        runId = randomUUID();
      brief.identity.electionDate = electionDate;
      brief.authorId = `fixture-author:${runId}`;
      brief.authorship = {
        kind: "generated",
        model: "author-model",
        promptVersion: "v1",
      };
      document.manifest.electionDate = electionDate;
      document.manifest.policyVersion = version;
      document.manifest.currentHashes = {
        [evidenceHashKey(brief.identity, "record")]: source.contentHash,
      };
      document.researchVersion = researchVersion;
      document.rosterSnapshotId = snapshotId;
      document.rosterDigest = hash(key);
      const dossier = candidateEvidenceDossierSchema.parse({
        schemaVersion: 1,
        identity: brief.identity,
        name: "Fixture candidate",
        officeFamily: "local",
        officeKind: "local",
        rosterDigest: document.rosterDigest,
        researchVersion,
        createdAt: brief.createdAt,
        sources: document.sources,
        evidence: [
          {
            id: "record",
            sourceId: source.id,
            excerpt: source.text,
            locator: "Fixture record",
            origin: "primary_record",
            role: "candidate_record",
            identityQualification: "exact_election_office",
          },
        ],
        gaps: [],
        classification: "evidence_gap",
        sourceSetDigest: hash(
          candidateDossierSourceProjection(document.sources),
        ),
        dossierDigest: "0".repeat(64),
      });
      dossier.dossierDigest = hash(candidateDossierSemanticProjection(dossier));
      const author = {
        role: "author",
        actorId: brief.authorId,
        runId,
        configuredModel: "author-model",
        actualModel: "author-model",
        provider: "fixture",
        requestId: null,
        promptVersion: "v1",
        policyVersion: version,
        sourceSetDigest: dossier.sourceSetDigest,
        dossierDigest: dossier.dossierDigest,
        revisionDigest: briefDigest(brief),
        startedAt: brief.createdAt,
        completedAt: brief.createdAt,
        usage: { inputTokens: 1, outputTokens: 1 },
        costUsd: null,
      };
      const reviewer = {
        ...author,
        role: "reviewer",
        actorId: `fixture-reviewer:${randomUUID()}`,
        runId: randomUUID(),
        configuredModel: "review-model",
        actualModel: "review-model",
      };
      document.candidateArtifacts = [
        {
          candidateId: brief.identity.candidateId,
          dossierDigest: dossier.dossierDigest,
          sourceSetDigest: dossier.sourceSetDigest,
          author,
          dossier,
        },
      ];
      return {
        document,
        attestation: {
          author,
          reviewer,
          verdict: "approve",
          findings: [
            {
              claimId: "record-claim",
              supported: true,
              reason: "Synthetic archived quote supports this fixture.",
            },
          ],
        },
      };
    }
    const old = [prepared(randomUUID(), v1), prepared(randomUUID(), v1)];
    const next = old.map((entry) => prepared(entry.document.pilotKey, v2));
    const source = required(required(old[0]).document.sources[0]);
    const snapshot = californiaRosterSnapshotSchema.parse({
      schemaVersion: 1,
      id: snapshotId,
      electionDate,
      scope: "ca_sos_certified",
      scopeLabel: "Synthetic policy fixture",
      source: {
        url: source.url,
        byteHash: source.contentHash,
        textHash: source.contentHash,
        fetchedAt: source.fetchedAt,
        encoding: "windows-1252",
        text: source.text,
      },
      certification: {
        url: source.url,
        textHash: source.contentHash,
        fetchedAt: source.fetchedAt,
        text: source.text,
      },
      races: old.map(({ document }) => {
        const brief = required(document.briefs[0]);
        return {
          raceKey: document.pilotKey,
          contestId: brief.identity.contestId,
          jurisdiction: brief.identity.jurisdiction,
          jurisdictionLabel: "Fixture",
          electionDate,
          sourceContestId: document.pilotKey,
          officeFamily: "local",
          office: "Mayor",
          district: null,
          kind: "election",
          rosterDigest: document.rosterDigest,
          members: [
            {
              identity: brief.identity,
              candidateId: brief.identity.candidateId,
              name: "Fixture candidate",
              sourceCandidateId: brief.identity.candidateId,
              partyCode: "",
              party: null,
              ballotStatus: "on_ballot",
            },
          ],
        };
      }),
      excludedContests: [],
      countyCoverage: [],
    });
    const collectionIds: string[] = [],
      releaseIds: string[] = [],
      preparedIds: string[] = [];
    const revisionIds = [...old, ...next].map(
      (entry) => required(entry.document.briefs[0]).revisionId,
    );
    try {
      await saveCaliforniaRoster(db, snapshot);
      const epoch = await beginCaliforniaSourceCheck(db, electionDate);
      assert.ok(epoch);
      await adoptResearchPolicy({ policy: policy(v1), collectionIds: [] });
      for (const entry of [...old, ...next]) {
        const { document, attestation } = entry,
          brief = required(document.briefs[0]);
        const claim = await claimCaliforniaRaceWork(db, {
          snapshotId,
          raceKey: document.pilotKey,
          rosterDigest: required(document.rosterDigest),
          policyVersion: document.manifest.policyVersion,
          researchVersion,
          owner: randomUUID(),
          expectedSourceEpoch: epoch,
        });
        assert.ok(claim);
        const lease = {
          key: claim.key,
          owner: claim.owner,
          generation: claim.generation,
          reviewEpoch: claim.reviewEpoch,
        };
        const isStaged = document.manifest.policyVersion === v2;
        const saved = await saveResearchCollection(document, db, {
          workLease: lease,
          ...(isStaged ? { stagedPolicyVersion: v2 } : {}),
        });
        collectionIds.push(saved.collectionId);
        await recordResearchAiReview({
          collectionId: saved.collectionId,
          revisionId: brief.revisionId,
          attestation,
          workLease: lease,
          ...(isStaged
            ? { policy: { approved: true as const, version: v2, automation } }
            : {}),
        });
        if (isStaged) preparedIds.push(saved.collectionId);
        else
          releaseIds.push(
            (
              await publishResearchCollection({
                collectionId: saved.collectionId,
                actorId: automation.serviceActorId,
                workLease: lease,
              })
            ).releaseId,
          );
      }
      await assert.rejects(
        adoptResearchPolicy({ policy: policy(v2), collectionIds: [] }),
        /every currently public race/,
      );
      await assert.rejects(
        adoptResearchPolicy({
          policy: policy(v2),
          collectionIds: [required(preparedIds[0])],
        }),
        /every currently public race/,
      );
      assert.equal((await activeResearchPolicy()).version, v1);
      const lateLegacy = structuredClone(required(old[0]).document);
      delete lateLegacy.candidateArtifacts;
      delete lateLegacy.researchVersion;
      delete lateLegacy.rosterSnapshotId;
      delete lateLegacy.rosterDigest;
      const beforeOverlapCollections = await db
        .select()
        .from(Collection)
        .where(
          inArray(
            Collection.pilotKey,
            old.map((entry) => entry.document.pilotKey),
          ),
        );
      let releaseBarrier!: () => void;
      let signalLocked!: () => void;
      const locked = new Promise<void>((resolve) => {
        signalLocked = resolve;
      });
      const barrier = new Promise<void>((resolve) => {
        releaseBarrier = resolve;
      });
      const blocker = db.transaction(async (tx) => {
        await lockPilot(tx, "policy");
        signalLocked();
        await barrier;
      });
      await locked;
      async function waitForPolicyWaiters(count: number) {
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
          const result = await db.execute(
            sql`select count(*)::int as count from pg_locks where locktype = 'advisory' and not granted and database = (select oid from pg_database where datname = current_database()) and objid::bigint = (hashtext('candidate-research:policy')::bigint & 4294967295)`,
          );
          if (Number(result.rows[0]?.count) >= count) return;
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        throw new Error(
          `Expected ${count} queued policy advisory lock waiters`,
        );
      }
      let adoption!: ReturnType<typeof adoptResearchPolicy>;
      let lateSave!: Promise<unknown>;
      try {
        adoption = adoptResearchPolicy({
          policy: policy(v2),
          collectionIds: preparedIds,
        });
        void adoption.catch(() => undefined);
        await waitForPolicyWaiters(1);
        lateSave = saveResearchCollection(lateLegacy, db);
        void lateSave.catch(() => undefined);
        await waitForPolicyWaiters(2);
      } finally {
        releaseBarrier();
        await blocker;
      }
      const adopted = await adoption;
      const afterAdoptionReleases = await db
        .select()
        .from(Release)
        .where(inArray(Release.id, adopted.releaseIds));
      await assert.rejects(
        lateSave,
        /automation policy does not accept legacy/,
      );
      assert.deepEqual(
        await db
          .select()
          .from(Collection)
          .where(
            inArray(
              Collection.pilotKey,
              old.map((entry) => entry.document.pilotKey),
            ),
          ),
        beforeOverlapCollections,
      );
      assert.deepEqual(
        await db
          .select()
          .from(Release)
          .where(inArray(Release.id, adopted.releaseIds)),
        afterAdoptionReleases,
      );
      releaseIds.push(...adopted.releaseIds);
      assert.equal(adopted.releaseIds.length, 2);
      assert.equal((await activeResearchPolicy()).version, v2);
      for (const id of adopted.releaseIds) {
        const [row] = await db.select().from(Release).where(eq(Release.id, id));
        assert.ok(row);
        const ids = row.document.members.map((m) => m.revisionId);
        const revisions = await db
          .select()
          .from(Revision)
          .where(inArray(Revision.id, ids));
        const events = await db
          .select()
          .from(Event)
          .where(inArray(Event.revisionId, ids));
        assert.ok(
          readCandidateRace({
            manifest: row.document,
            revokedReason: row.revokedReason,
            revisions,
            events,
            policy: await activeResearchPolicy(),
            now: new Date().toISOString(),
            currentRoster: await resolveCurrentResearchRoster(db, row.document),
          }),
        );
      }
    } finally {
      if (releaseIds.length)
        await db.delete(Release).where(inArray(Release.id, releaseIds));
      await db.delete(Event).where(inArray(Event.revisionId, revisionIds));
      if (collectionIds.length)
        await db
          .delete(Collection)
          .where(inArray(Collection.id, collectionIds));
      await db.delete(Revision).where(inArray(Revision.id, revisionIds));
      await db.delete(Work).where(eq(Work.snapshotId, snapshotId));
      await db.delete(Roster).where(eq(Roster.id, snapshotId));
      await db.delete(Policy).where(inArray(Policy.version, [v1, v2]));
    }
  },
);

void test(
  "current source observations bound initial and unchanged release expiry",
  { skip: !process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL },
  async () => {
    const url = required(process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL);
    assert.equal(new URL(url).pathname, "/billion_candidate_root_final_test");
    process.env.POSTGRES_URL = url;
    const { db } = await import("@acme/db/client");
    const { eq } = await import("@acme/db");
    const {
      CandidateResearchCollection: Collection,
      CandidateRaceRelease: Release,
      CandidateResearchPolicy: Policy,
      CandidateBriefRevision: Revision,
      CandidateBriefReviewEvent: Event,
    } = await import("@acme/db/schema");
    const { saveResearchCollection } =
      await import("./candidate-research-store");
    const { publishResearchCollection } =
      await import("./candidate-research-service");
    const document = fixture(),
      brief = required(document.briefs[0]);
    const version = `freshness-${randomUUID()}`;
    const agedAt = new Date(Date.now() - 23 * 3600000).toISOString();
    document.sources.forEach((source) => {
      source.fetchedAt = agedAt;
    });
    let collectionId: string | undefined, releaseId: string | undefined;
    try {
      await db.insert(Policy).values({
        version,
        approvedBy: "fixture",
        statement: "Disposable local freshness test policy.",
      });
      const saved = await saveResearchCollection(document, db);
      collectionId = saved.collectionId;
      const [stored] = await db
        .select()
        .from(Collection)
        .where(eq(Collection.id, collectionId));
      assert.equal(required(stored).checkedAt.toISOString(), agedAt);
      await db.insert(Event).values({
        revisionId: brief.revisionId,
        actorId: "independent-fixture",
        action: "approve",
        policyVersion: version,
        reason: "Synthetic exact revision review.",
        createdAt: new Date(),
      });
      releaseId = (
        await publishResearchCollection({ collectionId, actorId: "fixture" })
      ).releaseId;
      const [initial] = await db
        .select()
        .from(Release)
        .where(eq(Release.id, releaseId));
      assert.equal(
        required(initial).document.expiresAt,
        new Date(Date.parse(agedAt) + 86400000).toISOString(),
      );
      const renewed = structuredClone(document),
        freshAt = new Date().toISOString();
      renewed.sources.forEach((source) => {
        source.fetchedAt = freshAt;
      });
      renewed.manifest.sourceCheckedAt = freshAt;
      renewed.manifest.rosterVerifiedAt = freshAt;
      const result = await saveResearchCollection(renewed, db);
      assert.equal(result.collectionId, collectionId);
      const [current] = await db
        .select()
        .from(Collection)
        .where(eq(Collection.id, collectionId));
      assert.equal(required(current).checkedAt.toISOString(), freshAt);
      assert.deepEqual(required(current).document, required(stored).document);
      const [release] = await db
        .select()
        .from(Release)
        .where(eq(Release.id, releaseId));
      assert.equal(
        required(release).document.expiresAt,
        new Date(Date.parse(freshAt) + 86400000).toISOString(),
      );
      assert.equal(result.checkedAt, freshAt);
      renewed.manifest.rosterVerifiedAt = agedAt;
      const olderRoster = await saveResearchCollection(renewed, db);
      assert.equal(olderRoster.checkedAt, agedAt);
      const [rosterBoundRelease] = await db
        .select()
        .from(Release)
        .where(eq(Release.id, releaseId));
      assert.equal(
        required(rosterBoundRelease).document.expiresAt,
        new Date(Date.parse(agedAt) + 86400000).toISOString(),
      );
    } finally {
      if (releaseId) await db.delete(Release).where(eq(Release.id, releaseId));
      await db.delete(Event).where(eq(Event.revisionId, brief.revisionId));
      if (collectionId)
        await db.delete(Collection).where(eq(Collection.id, collectionId));
      await db.delete(Revision).where(eq(Revision.id, brief.revisionId));
      await db.delete(Policy).where(eq(Policy.version, version));
    }
  },
);

void test("observation bound uses current sources and required roster checks, not old brief retrieval dates", async () => {
  const { researchObservationBound } =
    await import("./candidate-research-store");
  const document = fixture();
  const now = Date.parse(document.manifest.sourceCheckedAt),
    sourceAt = new Date(now - 23 * 3600000).toISOString();
  required(document.sources[0]).fetchedAt = sourceAt;
  assert.equal(researchObservationBound(document).toISOString(), sourceAt);
  required(document.sources[0]).fetchedAt = document.manifest.sourceCheckedAt;
  document.manifest.rosterVerifiedAt = new Date(
    now - 2 * 3600000,
  ).toISOString();
  assert.equal(
    researchObservationBound(document).toISOString(),
    document.manifest.rosterVerifiedAt,
  );
  document.manifest.rosterVerifiedAt = document.manifest.sourceCheckedAt;
  required(required(document.briefs[0]).evidence[0]).retrievedAt = new Date(
    now - 90 * 86400000,
  ).toISOString();
  assert.equal(
    researchObservationBound(document).toISOString(),
    document.manifest.sourceCheckedAt,
  );
});
