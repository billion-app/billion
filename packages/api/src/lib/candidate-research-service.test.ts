import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import { candidateResearchCollectionSchema } from "@acme/validators";

import { briefDigest, evidenceHashKey } from "./candidate-brief-publication";
import { readCandidateRace } from "./candidate-race-release";
import { validResearchAttestation } from "./candidate-research-attestation";

function required<T>(value: T | undefined): T {
  assert.ok(value);
  return value;
}

function fixture(key = randomUUID()) {
  const now = new Date(Date.now() - 1000).toISOString();
  const text = "A synthetic public record identifies this candidate.";
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
  const value = {
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
    },
    now: new Date().toISOString(),
  };
  assert.equal(validResearchAttestation(input), true);
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
    const lease = { key, owner: "old-owner", generation: 1 };
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
          { key, owner: "new-owner", generation: 2 },
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
        { workLease: { key, owner: "new-owner", generation: 2 } },
      );
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
    const version = `ai-${randomUUID()}`;
    document.manifest.electionDate = "2097-11-03";
    brief.identity.electionDate = "2097-11-03";
    document.manifest.currentHashes = {
      [evidenceHashKey(brief.identity, "record")]: source.contentHash,
    };
    const snapshotId = hash(randomUUID()),
      rosterDigest = hash(randomUUID());
    const successorSnapshotId = hash(randomUUID());
    const researchVersion = "ai-fixture-v1";
    brief.authorship = {
      kind: "generated",
      model: "author-model",
      promptVersion: "v1",
    };
    document.rosterSnapshotId = snapshotId;
    document.rosterDigest = rosterDigest;
    document.researchVersion = researchVersion;
    document.manifest.policyVersion = version;
    const dossier = candidateEvidenceDossierSchema.parse({
      schemaVersion: 1,
      identity: brief.identity,
      name: "Fixture candidate",
      officeFamily: "local",
      officeKind: "local",
      rosterDigest,
      researchVersion,
      createdAt: brief.createdAt,
      sources: [source],
      evidence: [
        {
          id: "record",
          sourceId: "record",
          excerpt: source.text,
          locator: "Fixture",
          origin: "primary_record",
          role: "roster",
          identityQualification: "official_roster",
        },
      ],
      gaps: [],
      classification: "evidence_gap",
      sourceSetDigest: hash([
        {
          id: source.id,
          url: source.url,
          publisher: source.publisher,
          format: source.format,
          contentHash: source.contentHash,
        },
      ]),
      dossierDigest: "0".repeat(64),
    });
    const {
      dossierDigest: _digest,
      createdAt: _created,
      sources: _sources,
      ...semantic
    } = dossier;
    dossier.dossierDigest = hash(semantic);
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
          officeFamily: "local",
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
      releaseIds: string[] = [];
    let lease: { key: string; owner: string; generation: number } | undefined;
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
      };
      const saved = await saveResearchCollection(document, db, {
        workLease: lease,
      });
      collectionIds.push(saved.collectionId);
      await recordResearchAiReview({
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
      };
      const recovered = await saveResearchCollection(document, db, {
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
    } finally {
      if (releaseIds.length)
        await db.delete(Release).where(inArray(Release.id, releaseIds));
      await db.delete(Event).where(eq(Event.revisionId, brief.revisionId));
      if (collectionIds.length)
        await db
          .delete(Collection)
          .where(inArray(Collection.id, collectionIds));
      await db.delete(Revision).where(eq(Revision.id, brief.revisionId));
      await db.delete(Work).where(eq(Work.snapshotId, snapshotId));
      await db
        .delete(Work)
        .where(eq(Work.key, `source-epoch:${snapshot.electionDate}`));
      await db.delete(Roster).where(eq(Roster.id, snapshotId));
      await db.delete(Roster).where(eq(Roster.id, successorSnapshotId));
      await db.delete(Policy).where(eq(Policy.version, version));
    }
  },
);
