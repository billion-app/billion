import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import dns from "node:dns/promises";
import { readFile } from "node:fs/promises";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import test from "node:test";

import type {
  CandidateBrief,
  CandidateEvidenceDossier,
  CandidateModelAttestation,
  CandidateResearchCollectionDocument,
  ResearchSource,
} from "@acme/validators";
import { ResearchReviewCollectionConflict } from "@acme/api/lib/candidate-brief-publication";
import {
  candidateBriefSchema,
  candidateEvidenceDossierSchema,
} from "@acme/validators";

import type {
  CaliforniaBounds,
  CaliforniaDependencies,
  CaliforniaWorkCheckpoint,
} from "./california.js";
import {
  californiaInvocationFailure,
  CaliforniaModelInvocationError,
} from "./california-ai.js";
import {
  buildCaliforniaDossier,
  evidenceDigest,
} from "./california-dossier.js";
import {
  CaliforniaBudgetReached,
  CaliforniaCitedSourceFailure,
  collectCaliforniaEvidence,
  fetchBoundedCaliforniaSource,
} from "./california-evidence.js";
import { decodeCaliforniaRoster } from "./california-roster.js";
import {
  coverage,
  fetchCaliforniaPlan,
  plan,
  reconcile,
} from "./california.js";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const bounds: CaliforniaBounds = {
  maxRaces: 2,
  maxCandidates: 4,
  maxSourceRequests: 20,
  maxSourceBytes: 2_000_000,
  maxModelCalls: 8,
  maxInputTokens: 200_000,
  concurrency: 1,
};
async function fixture() {
  const now = "2026-10-30T12:00:00.000Z";
  const bytes = await readFile(
    new URL("./fixtures/C26GG.txt", import.meta.url),
  );
  const text = await readFile(
    new URL("./fixtures/certified-2026.txt", import.meta.url),
    "utf8",
  );
  const certification: ResearchSource = {
    id: "cert",
    url: "https://example.gov/cert.pdf",
    publisher: "SOS",
    format: "pdf",
    text,
    contentHash: hash(text),
    fetchedAt: now,
  };
  const original = decodeCaliforniaRoster({
    bytes,
    fetchedAt: now,
    certification,
  });
  const snapshot = {
    ...original,
    races: [original.races[0]!, original.races[2]!],
  };
  const artifacts = new Map<string, unknown>();
  const rows = new Map<
    string,
    { raceKey: string; status: string; checkpoint: unknown }
  >();
  const stats = {
    authors: 0,
    reviews: 0,
    releases: 0,
    failures: 0,
    investigations: 0,
    authorized: true,
  };
  const attest = (
    brief: CandidateBrief,
    dossier: CandidateEvidenceDossier,
    role: "author" | "reviewer",
  ): CandidateModelAttestation => ({
    role,
    actorId: role === "author" ? brief.authorId : `reviewer:${randomUUID()}`,
    runId: randomUUID(),
    configuredModel: role,
    actualModel: role,
    provider: "fixture",
    requestId: null,
    promptVersion: "fixture",
    policyVersion: "policy",
    sourceSetDigest: dossier.sourceSetDigest,
    dossierDigest: dossier.dossierDigest,
    revisionDigest: evidenceDigest(brief),
    startedAt: now,
    completedAt: now,
    usage: { inputTokens: 100, outputTokens: 100 },
    costUsd: null,
  });
  const deps: CaliforniaDependencies = {
    demandedRaceKeys: async () => snapshot.races.map((race) => race.raceKey),
    now: () => now,
    readPublishedCoverage: async () => ({ snapshotId: snapshot.id, races: [] }),
    authorizedPolicy: async () => stats.authorized,
    loadSnapshot: async () => snapshot,
    fetchRoster: async () => snapshot,
    saveSnapshot: async () => {},
    beginSourceCheck: async () => ({ key: "fixture-epoch", generation: 1 }),
    listWork: async () => [...rows.values()],
    claim: async (input) => ({
      ...input,
      key: input.raceKey,
      generation: 1,
      reviewEpoch: 0,
      checkpoint: rows.get(input.raceKey)?.checkpoint,
    }),
    checkpoint: async (lease, status, value) => {
      rows.set(lease.key, { raceKey: lease.key, status, checkpoint: value });
      return true;
    },
    artifact: async (key) => artifacts.get(key) ?? null,
    hasArtifact: async (key) => artifacts.has(key),
    reserveDispatch: async (input) => {
      if (artifacts.has(input.key)) return false;
      artifacts.set(input.key, input.document);
      return true;
    },
    saveArtifact: async (input) => {
      if (!artifacts.has(input.key)) artifacts.set(input.key, input.document);
      return artifacts.get(input.key);
    },
    investigate: async ({ race, member }) => {
      stats.investigations++;
      const line = snapshot.source.text
        .split(/\r?\n/)
        .find((s) => s.includes(`|${member.sourceCandidateId}|`))!;
      const recordSourceId = `candidate-record:${member.sourceCandidateId}`;
      const record = `Synthetic test record: ${member.name} served on the fixture student-access oversight committee in 2024.`;
      return buildCaliforniaDossier({
        identity: member.identity,
        name: member.name,
        officeFamily: race.officeFamily,
        officeKind: "state_executive",
        rosterDigest: race.rosterDigest,
        researchVersion: "california-dossier-v1",
        createdAt: now,
        sources: [
          {
            id: "roster",
            url: snapshot.source.url,
            publisher: "SOS",
            format: "text",
            text: snapshot.source.text,
            contentHash: snapshot.source.textHash,
            fetchedAt: now,
          },
          {
            id: recordSourceId,
            url: `https://fixture.example.gov/record/${encodeURIComponent(member.candidateId)}`,
            publisher: "Synthetic candidate record fixture",
            format: "text",
            text: record,
            contentHash: hash(record),
            fetchedAt: now,
          },
        ],
        evidence: [
          {
            id: "roster",
            sourceId: "roster",
            excerpt: line,
            locator: "record",
            origin: "primary_record",
            role: "roster",
            identityQualification: "official_roster",
          },
          {
            id: "candidate-record",
            sourceId: recordSourceId,
            excerpt: record,
            locator: "Synthetic candidate-specific record",
            origin: "primary_record",
            role: "candidate_record",
            identityQualification: "exact_election_office",
          },
        ],
        gaps: [],
      });
    },
    author: async ({ dossier }) => {
      stats.authors++;
      const candidateEvidence = dossier.evidence.find(
        (evidence) =>
          evidence.role === "candidate_record" ||
          evidence.role === "candidate_statement",
      );
      const brief = candidateBriefSchema.parse({
        schemaVersion: 1,
        identity: dossier.identity,
        revisionId: randomUUID(),
        supersedes: null,
        createdAt: now,
        authorId: `author:${randomUUID()}`,
        authorship: {
          kind: "generated",
          model: "fixture",
          promptVersion: "fixture",
        },
        evidence: dossier.evidence.map((e) => {
          const source = dossier.sources.find(
            (source) => source.id === e.sourceId,
          )!;
          return {
            id: e.id,
            url: source.url,
            publisher: source.publisher,
            locator: e.locator,
            retrievedAt: source.fetchedAt,
            documentDate: null,
            contentHash: source.contentHash,
            excerpt: e.excerpt,
            origin: e.origin,
          };
        }),
        sections: [
          "priorities",
          "record",
          "mechanisms",
          "effects",
          "tradeoffs",
          "unknowns",
        ].map((topic) => ({
          topic,
          missingEvidence:
            candidateEvidence &&
            topic ===
              (candidateEvidence.role === "candidate_statement"
                ? "priorities"
                : "record")
              ? null
              : "No additional candidate-specific evidence was located in the checked sources.",
          claims:
            candidateEvidence &&
            topic ===
              (candidateEvidence.role === "candidate_statement"
                ? "priorities"
                : "record")
              ? [
                  {
                    id: "candidate-claim",
                    kind:
                      candidateEvidence.origin === "candidate"
                        ? "promise"
                        : "fact",
                    text: candidateEvidence.excerpt,
                    evidenceIds: [candidateEvidence.id],
                  },
                ]
              : [],
        })),
        correction: null,
      });
      return { brief, attestation: attest(brief, dossier, "author") };
    },
    review: async ({ brief, dossier }) => {
      stats.reviews++;
      return {
        verdict: "approve",
        findings: [],
        attestation: attest(brief, dossier, "reviewer"),
      };
    },
    saveCollection: async (document) => ({
      collectionId: document.manifest.id,
      changed: true,
      checkedAt: document.manifest.sourceCheckedAt,
    }),
    attest: async () => {},
    publish: async () => {
      stats.releases++;
      return { releaseId: randomUUID() };
    },
    invalidateElection: async () => {
      stats.failures++;
    },
    fail: async () => {
      stats.failures++;
    },
  };
  return { deps, snapshot, stats, artifacts, rows, allRaces: original.races };
}

test("empty ballot demand and explicit empty operator scope perform no source, lease, publication or model work", async () => {
  for (const raceKeys of [undefined, []]) {
    const f = await fixture();
    f.deps.demandedRaceKeys = async () => [];
    for (const key of [
      "beginSourceCheck",
      "fetchRoster",
      "listWork",
      "claim",
      "invalidateElection",
      "publish",
    ] as const) {
      f.deps[key] = async () => {
        throw new Error(`must not call ${key}`);
      };
    }
    const result = await reconcile(
      { snapshotId: f.snapshot.id, policyVersion: "policy", bounds, raceKeys },
      f.deps,
    );
    assert.equal(result.completed, 0);
    assert.deepEqual(result.outcomes, []);
    assert.equal(result.usage.sourceRequests, 0);
    assert.equal(result.usage.modelCalls, 0);
    assert.equal(f.stats.investigations, 0);
    assert.equal(f.stats.authors, 0);
    assert.equal(f.stats.failures, 0);
  }
});

test("one demanded race researches all authoritative members without widening to other races", async () => {
  const f = await fixture();
  const demanded = f.snapshot.races[1]!;
  f.deps.demandedRaceKeys = async () => [demanded.raceKey];
  const result = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      bounds,
      includePilotRaces: true,
    },
    f.deps,
  );
  assert.ok(result.outcomes.length);
  assert.ok(
    result.outcomes.every((outcome) => outcome.raceKey === demanded.raceKey),
  );
  assert.equal(f.stats.investigations, demanded.members.length);
});
test("closed automation policy stops before any source or model work", async () => {
  const f = await fixture();
  f.stats.authorized = false;
  await assert.rejects(
    () =>
      reconcile(
        { snapshotId: f.snapshot.id, policyVersion: "policy", bounds },
        f.deps,
      ),
    /automation policy/,
  );
  assert.equal(f.stats.investigations, 0);
  assert.equal(f.stats.authors, 0);
});
test("bounded complete races resume with exact model artifact reuse after saving a collection fails", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  let fail = true;
  f.deps.saveCollection = async (document) => {
    if (fail) {
      fail = false;
      throw new Error("simulated collection interruption");
    }
    return {
      collectionId: document.manifest.id,
      changed: true,
      checkedAt: document.manifest.sourceCheckedAt,
    };
  };
  const first = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      bounds: { ...bounds, maxRaces: 1 },
    },
    f.deps,
  );
  assert.equal(first.blocked, 1);
  const authored = f.stats.authors;
  const reviewed = f.stats.reviews;
  const second = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      bounds: { ...bounds, maxRaces: 1 },
    },
    f.deps,
  );
  assert.equal(second.completed, 1, JSON.stringify(second));
  assert.equal(f.stats.authors, authored);
  assert.equal(f.stats.reviews, reviewed);
});
test("a successor snapshot reuses authors but obtains reviews for its own work scope", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  const successor = {
    ...structuredClone(f.snapshot),
    id: hash(`${f.snapshot.id}:renewed-source-approval-contract`),
  };
  const snapshots = new Map(
    [f.snapshot, successor].map((snapshot) => [snapshot.id, snapshot]),
  );
  let current = f.snapshot;
  const rows = new Map<
    string,
    {
      snapshotId: string;
      raceKey: string;
      status: string;
      checkpoint: unknown;
    }
  >();
  const reviewCollections = new Map<string, string>();
  const reviewEpochs: number[] = [];
  f.deps.loadSnapshot = async (id) => snapshots.get(id) ?? null;
  f.deps.fetchRoster = async () => current;
  f.deps.listWork = async (snapshotId) =>
    [...rows.values()].filter((row) => row.snapshotId === snapshotId);
  f.deps.claim = async (input) => {
    const key = hash(
      JSON.stringify([
        input.snapshotId,
        input.raceKey,
        input.rosterDigest,
        input.policyVersion,
        input.researchVersion,
      ]),
    );
    const previous = rows.get(key);
    rows.set(key, {
      snapshotId: input.snapshotId,
      raceKey: input.raceKey,
      status: "pending",
      checkpoint: previous?.checkpoint,
    });
    reviewEpochs.push(0);
    return {
      key,
      owner: input.owner,
      generation: 1,
      reviewEpoch: 0,
      checkpoint: previous?.checkpoint,
    };
  };
  f.deps.checkpoint = async (lease, status, checkpoint) => {
    rows.set(lease.key, { ...rows.get(lease.key)!, status, checkpoint });
    return true;
  };
  f.deps.attest = async ({ collectionId, review }) => {
    const previous = reviewCollections.get(review.attestation.runId);
    if (previous && previous !== collectionId)
      throw new Error(
        "A superseded collection's reviewer invocation cannot approve a new source generation",
      );
    reviewCollections.set(review.attestation.runId, collectionId);
  };
  const run = () =>
    reconcile(
      {
        snapshotId: current.id,
        policyVersion: "policy",
        bounds: { ...bounds, maxRaces: 1 },
      },
      f.deps,
    );
  const first = await run();
  assert.equal(first.completed, 1, JSON.stringify(first));
  current = successor;
  const second = await run();
  assert.equal(second.completed, 1, JSON.stringify(second));
  const members = f.snapshot.races[0]!.members.length;
  assert.equal(f.stats.authors, members);
  assert.equal(f.stats.reviews, 2 * members);
  assert.equal(f.stats.releases, 2);
  assert.equal(reviewCollections.size, 2 * members);
  assert.equal(rows.size, 2);
  assert.deepEqual(reviewEpochs, [0, 0]);
});
test("a saved collection conflict refreshes only reviews and checkpoints the actual publisher invocations", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  const race = f.snapshot.races[0]!;
  const firstCollection = randomUUID();
  const secondCollection = randomUUID();
  let collectionId = firstCollection;
  const bindings = new Map<string, string>();
  const published = new Map<string, CandidateModelAttestation>();
  f.deps.saveCollection = async (document) => ({
    collectionId,
    changed: true,
    checkedAt: document.manifest.sourceCheckedAt,
  });
  f.deps.attest = async (input) => {
    const prior = bindings.get(input.review.attestation.runId);
    if (prior && prior !== input.collectionId)
      throw new ResearchReviewCollectionConflict(
        input.collectionId,
        input.revisionId,
        input.review.attestation.runId,
      );
    bindings.set(input.review.attestation.runId, input.collectionId);
    published.set(input.dossier.identity.candidateId, input.review.attestation);
  };
  const run = () =>
    reconcile(
      {
        snapshotId: f.snapshot.id,
        policyVersion: "policy",
        bounds: { ...bounds, maxRaces: 1 },
      },
      f.deps,
    );
  assert.equal((await run()).completed, 1);
  const firstReviews = new Map(published);
  collectionId = secondCollection;
  const refreshed = await run();
  assert.equal(refreshed.completed, 1, JSON.stringify(refreshed));
  assert.equal(refreshed.usage.modelCalls, race.members.length);
  assert.equal(f.stats.authors, race.members.length);
  assert.equal(f.stats.reviews, race.members.length * 2);
  const checkpoint = f.rows.get(race.raceKey)!
    .checkpoint as CaliforniaWorkCheckpoint;
  assert.equal(checkpoint.collectionId, secondCollection);
  for (const member of race.members) {
    const provenance = checkpoint.candidateProvenance![member.candidateId]!;
    assert.deepEqual(provenance.reviewer, published.get(member.candidateId));
    assert.notEqual(
      provenance.reviewer!.runId,
      firstReviews.get(member.candidateId)!.runId,
    );
    assert.equal(provenance.verdict, "approve");
    const reviews = provenance
      .modelArtifactKeys!.filter((key) => key.startsWith("review:"))
      .map(
        (key) =>
          f.artifacts.get(key) as { attestation: CandidateModelAttestation },
      );
    assert.ok(
      reviews.some(
        (review) => review.attestation.runId === provenance.reviewer!.runId,
      ),
    );
  }
});

test("an unknown collection review blocks ordinary coordinator retries before attestation or publication", async () => {
  for (const change of ["cached", "epoch", "configuration"] as const) {
    const f = await fixture();
    f.snapshot.races.splice(1);
    let collectionId = randomUUID();
    const bindings = new Map<string, string>();
    let attests = 0;
    f.deps.saveCollection = async (document) => ({
      collectionId,
      changed: true,
      checkedAt: document.manifest.sourceCheckedAt,
    });
    f.deps.attest = async (input) => {
      attests++;
      const prior = bindings.get(input.review.attestation.runId);
      if (prior && prior !== input.collectionId)
        throw new ResearchReviewCollectionConflict(
          input.collectionId,
          input.revisionId,
          input.review.attestation.runId,
        );
      bindings.set(input.review.attestation.runId, input.collectionId);
    };
    const run = () =>
      reconcile(
        {
          snapshotId: f.snapshot.id,
          policyVersion: "policy",
          bounds: { ...bounds, maxRaces: 1 },
        },
        f.deps,
      );
    assert.equal((await run()).completed, 1);
    collectionId = randomUUID();
    const review = f.deps.review;
    f.deps.review = async () => {
      f.stats.reviews++;
      throw new Error("lost response");
    };
    assert.equal((await run()).blocked, 1);
    const before = { ...f.stats, attests };
    f.deps.review = review;
    if (change === "configuration")
      f.deps.reviewerConfigurationKey = "changed-configuration";
    if (change === "epoch") {
      const claim = f.deps.claim;
      f.deps.claim = async (input) => {
        const lease = await claim(input);
        return lease ? { ...lease, reviewEpoch: lease.reviewEpoch + 1 } : lease;
      };
    }
    const resumed = await run();
    assert.equal(resumed.blocked, 1, JSON.stringify(resumed));
    assert.equal(resumed.usage.modelCalls, 0, change);
    assert.equal(f.stats.reviews, before.reviews, change);
    assert.equal(f.stats.authors, before.authors, change);
    assert.equal(attests, before.attests, change);
    assert.equal(f.stats.releases, before.releases, change);
  }
});

test("a rejected review stays blocked on retries and cannot publish", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  const review = f.deps.review;
  f.deps.review = async (input) => ({
    ...(await review(input)),
    verdict: "reject",
  });
  for (let i = 0; i < 2; i++) {
    const result = await reconcile(
      {
        snapshotId: f.snapshot.id,
        policyVersion: "policy",
        bounds: { ...bounds, maxRaces: 1 },
      },
      f.deps,
    );
    assert.equal(result.blocked, 1);
  }
  assert.equal(f.stats.releases, 0);
  assert.equal(f.stats.reviews, 1);
});
test("uncertain invocation dispatch is not repeated after an author transport failure", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  f.deps.author = async () => {
    f.stats.authors++;
    throw new Error("transport lost after dispatch");
  };
  for (let i = 0; i < 2; i++)
    await reconcile(
      {
        snapshotId: f.snapshot.id,
        policyVersion: "policy",
        bounds: { ...bounds, maxRaces: 1 },
      },
      f.deps,
    );
  assert.equal(f.stats.authors, 1);
  assert.equal(f.stats.releases, 0);
});
test("candidate bound never publishes a partial race", async () => {
  const f = await fixture();
  const result = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      bounds: { ...bounds, maxCandidates: 1 },
    },
    f.deps,
  );
  assert.equal(result.completed, 0);
  assert.equal(f.stats.authors, 0);
  assert.equal(f.stats.releases, 0);
});
test("coverage retains every authoritative candidate even before work", async () => {
  const f = await fixture();
  const result = await coverage({ snapshotId: f.snapshot.id }, f.deps);
  assert.equal(result.expected.candidates, 4);
  assert.equal(result.races.flatMap((r) => r.candidateIds).length, 4);
  assert.equal(result.countyCoverage.length, 58);
  const planned = await plan({ electionDate: "2026-11-03" }, f.deps);
  assert.equal(planned.persisted, false);
});

test("blocked backfill does not starve the next authoritative race", async () => {
  const f = await fixture();
  f.deps.author = async () => {
    f.stats.authors++;
    throw new Error("unavailable provider");
  };
  const first = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      bounds: { ...bounds, maxRaces: 1 },
    },
    f.deps,
  );
  const second = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      bounds: { ...bounds, maxRaces: 1 },
    },
    f.deps,
  );
  assert.notEqual(
    first.outcomes.find((item) => item.status === "blocked")?.raceKey,
    second.outcomes.find((item) => item.status === "blocked")?.raceKey,
  );
});

test("exact race selection happens before run limits and rejects unknown targets", async () => {
  const f = await fixture();
  const target = f.snapshot.races[1]!;
  const result = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      raceKeys: [target.raceKey],
      bounds: { ...bounds, maxRaces: 1 },
    },
    f.deps,
  );
  assert.equal(result.outcomes.length, 1);
  assert.equal(result.outcomes[0]!.raceKey, target.raceKey);
  assert.equal(result.completed, 1, JSON.stringify(result));
  await assert.rejects(
    () =>
      reconcile(
        {
          snapshotId: f.snapshot.id,
          policyVersion: "policy",
          raceKeys: ["invented"],
          bounds,
        },
        f.deps,
      ),
    /absent from the authoritative snapshot/,
  );
});

test("explicit future-policy preparation saves reviewed collections without publishing", async () => {
  const f = await fixture();
  const result = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      raceKeys: [f.snapshot.races[0]!.raceKey],
      preparationPolicy: {
        approved: true,
        version: "policy",
        automation: {},
        approvedBy: "actual-owner",
        statement:
          "The accountable owner explicitly authorizes this future policy preparation with independent model review before its atomic activation.",
      },
      bounds,
    },
    f.deps,
  );
  assert.equal(result.prepared, 1, JSON.stringify(result));
  assert.ok(result.outcomes[0]?.collectionId);
  assert.equal(f.stats.releases, 0);
});
test("future-policy review rejection preserves the currently published source-valid release", async () => {
  const f = await fixture();
  const review = f.deps.review;
  f.deps.review = async (input) => ({
    ...(await review(input)),
    verdict: "reject",
  });
  await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      raceKeys: [f.snapshot.races[0]!.raceKey],
      preparationPolicy: {
        approved: true,
        version: "policy",
        automation: {},
        approvedBy: "actual-owner",
        statement:
          "The accountable owner explicitly authorizes this future policy preparation with independent model review before its atomic activation.",
      },
      bounds,
    },
    f.deps,
  );
  assert.equal(f.stats.releases, 0);
  assert.equal(f.stats.failures, 0);
});
test("planning cannot silently replace a combined local scope with state-only coverage", async () => {
  const f = await fixture();
  const state = { ...f.snapshot };
  f.deps.loadSnapshot = async () => ({
    ...state,
    scope: "ca_sos_certified_and_san_jose",
  });
  f.deps.fetchRoster = async () => state;
  await assert.rejects(
    () => plan({ electionDate: "2026-11-03", apply: true }, f.deps),
    /combined San José snapshot is active/,
  );
});

test("failed model output and known usage persist privately without leaking raw text in run report", async () => {
  const f = await fixture();
  f.deps.author = async () => {
    throw californiaInvocationFailure(
      {
        text: "private invalid generated text",
        usage: { inputTokens: 123, outputTokens: 45 },
        response: { modelId: "fixture-model", id: "request-fixture" },
      },
      {
        role: "author",
        configuredModel: "fixture-model",
        provider: "fixture",
        startedAt: f.deps.now(),
        completedAt: f.deps.now(),
      },
      true,
    );
  };
  const result = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      raceKeys: [f.snapshot.races[0]!.raceKey],
      bounds,
    },
    f.deps,
  );
  assert.equal(result.usage.actualInputTokens, 123);
  assert.equal(
    JSON.stringify(result).includes("private invalid generated text"),
    false,
  );
  const failure = [...f.artifacts.entries()].find(([key]) =>
    key.startsWith("failure:"),
  );
  assert.ok(failure);
  assert.ok(
    JSON.stringify(failure[1]).includes("private invalid generated text"),
  );
  assert.ok([...f.artifacts.keys()].some((key) => key.startsWith("dispatch:")));
});

test("required shared roster refresh failure fences all election publication before any model call", async () => {
  const f = await fixture();
  f.deps.fetchRoster = async () => {
    throw new Error("official roster unavailable");
  };
  await assert.rejects(
    () =>
      reconcile(
        { snapshotId: f.snapshot.id, policyVersion: "policy", bounds },
        f.deps,
      ),
    /official roster unavailable/,
  );
  assert.equal(f.stats.failures, 1);
  assert.equal(f.stats.authors, 0);
});

test("complete checkpoints do not masquerade as public coverage after expiry or withdrawal", async () => {
  const f = await fixture();
  const race = f.snapshot.races[0]!;
  f.rows.set(race.raceKey, {
    raceKey: race.raceKey,
    status: "complete",
    checkpoint: {
      releaseId: randomUUID(),
      classification: { [race.members[0]!.candidateId]: "supported" },
    },
  });
  const result = await coverage({ snapshotId: f.snapshot.id }, f.deps);
  assert.equal(result.races[0]!.workStatus, "complete");
  assert.equal(result.races[0]!.publicationStatus, "unavailable");
  assert.equal(result.races[0]!.releaseId, null);
  assert.deepEqual(result.published, { races: 0, candidates: 0 });
});

test("generic collection handoff binds full dossiers without duplicating unrelated scope archives", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  f.snapshot.additionalSources = [
    {
      id: "unrelated-gis",
      url: "https://county.example.gov/gis",
      publisher: "County",
      format: "text",
      text: "Unrelated countywide territorial archive.",
      contentHash: "a".repeat(64),
      fetchedAt: f.deps.now(),
    },
  ];
  let saved = false;
  f.deps.saveCollection = async (document) => {
    assert.equal(
      document.sources.some((source) => source.id === "unrelated-gis"),
      false,
    );
    assert.equal(
      document.candidateArtifacts?.length,
      f.snapshot.races[0]!.members.length,
    );
    for (const artifact of document.candidateArtifacts ?? []) {
      const dossier = candidateEvidenceDossierSchema.parse(artifact.dossier);
      assert.equal(dossier.dossierDigest, artifact.dossierDigest);
      assert.equal(dossier.sourceSetDigest, artifact.sourceSetDigest);
      assert.equal(dossier.identity.candidateId, artifact.candidateId);
    }
    saved = true;
    return {
      collectionId: document.manifest.id,
      changed: true,
      checkedAt: document.manifest.sourceCheckedAt,
    };
  };
  const result = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      bounds: { ...bounds, maxRaces: 1 },
    },
    f.deps,
  );
  assert.equal(result.completed, 1);
  assert.equal(saved, true);
  const rosterChecks = [...f.artifacts.entries()].filter(([key]) =>
    key.startsWith("roster-check:"),
  );
  assert.equal(rosterChecks.length, 1);
  assert.equal(
    JSON.stringify(rosterChecks[0]).includes(
      "Unrelated countywide territorial archive.",
    ),
    false,
  );
});

test("published race uncertain review reservation remains blocked across new lease generations", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  const race = f.snapshot.races[0]!;
  f.rows.set(race.raceKey, {
    raceKey: race.raceKey,
    status: "complete",
    checkpoint: {
      collectionId: randomUUID(),
      releaseId: randomUUID(),
      sourceCheckedAt: "2026-10-28T00:00:00.000Z",
    },
  });
  let generation = 0,
    calls = 0;
  const claim = f.deps.claim;
  f.deps.claim = async (input) => ({
    ...(await claim(input))!,
    generation: ++generation,
    reviewEpoch: 0,
  });
  f.deps.review = async () => {
    calls++;
    throw Error("review transport uncertain");
  };
  const input = {
    snapshotId: f.snapshot.id,
    policyVersion: "policy",
    bounds: { ...bounds, maxRaces: 1 },
  };
  await reconcile(input, f.deps);
  await reconcile(input, f.deps);
  assert.equal(generation, 2);
  assert.equal(calls, 1);
  assert.equal(f.stats.failures, 0);
});

test("observed cited source changes withdraw before any model work", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  f.deps.investigate = async () => {
    throw new CaliforniaCitedSourceFailure("Previously cited source changed");
  };
  const result = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      bounds: { ...bounds, maxRaces: 1 },
    },
    f.deps,
  );
  assert.equal(result.blocked, 1);
  assert.equal(f.stats.failures, 1);
  assert.equal(f.stats.authors, 0);
  assert.equal(f.stats.reviews, 0);
});

for (const role of ["author", "review"] as const) {
  test(`atomic ${role} dispatch admits only the replacement lease after the first owner pauses`, async () => {
    const f = await fixture();
    f.snapshot.races.splice(1);
    let generation = 0;
    let pauseReached!: () => void;
    let replacementClaimed!: () => void;
    const paused = new Promise<void>((resolve) => {
      pauseReached = resolve;
    });
    const replaced = new Promise<void>((resolve) => {
      replacementClaimed = resolve;
    });
    const claim = f.deps.claim;
    f.deps.claim = async (input) => {
      const lease = { ...(await claim(input))!, generation: ++generation };
      if (generation === 2) replacementClaimed();
      return lease;
    };
    const reserve = f.deps.reserveDispatch;
    f.deps.reserveDispatch = async (input) => {
      if (
        input.key.startsWith(`dispatch:${role}:`) &&
        input.workLease.generation === 1
      ) {
        pauseReached();
        await replaced;
      }
      if (input.workLease.generation !== generation) return false;
      return reserve(input);
    };
    let calls = 0;
    if (role === "author")
      f.deps.author = async () => {
        calls++;
        throw Error("uncertain author outcome");
      };
    else
      f.deps.review = async () => {
        calls++;
        throw Error("uncertain reviewer outcome");
      };
    const input = {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      bounds: { ...bounds, maxRaces: 1 },
    };
    const expired = reconcile(input, f.deps);
    await paused;
    const replacement = reconcile(input, f.deps);
    const results = await Promise.all([expired, replacement]);
    assert.equal(generation, 2);
    assert.equal(calls, 1);
    assert.equal(
      [...f.artifacts.keys()].filter((key) =>
        key.startsWith(`dispatch:${role}:`),
      ).length,
      1,
    );
    assert.equal(
      results.reduce((total, result) => total + result.usage.modelCalls, 0),
      role === "author" ? 1 : 2,
    );
    assert.equal(f.stats.failures, 0);
  });
}

test("equivalent compiled CDE asset refreshes preserve the roster and archive only changed bodies", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  const race = f.snapshot.races[0]!;
  const releaseId = randomUUID();
  const baseTime = f.deps.now();
  let observedAt = baseTime,
    assetVersion = 0,
    snapshotWrites = 0;
  const gisText = JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        properties: { district: "1" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-121.9, 37.3],
              [-121.8, 37.3],
              [-121.8, 37.4],
              [-121.9, 37.3],
            ],
          ],
        },
      },
    ],
    padding: " ".repeat(20000),
  });
  const cde = (version: number) =>
    `<html><head><script src="/assets/district-profile-${version}.js"></script></head><body><h1>District Profile</h1><p>County: Santa Clara</p><p>District: Fixture Unified School District</p></body></html>`;
  const observedSource = (
    id: string,
    url: string,
    text: string,
  ): ResearchSource => ({
    id,
    url,
    publisher: "Fixture authoritative source",
    format: "text",
    text,
    contentHash: hash(text),
    byteHash: hash(text),
    fetchedAt: observedAt,
  });
  f.snapshot.additionalSources = [
    observedSource(
      "cde-profile",
      "https://www.cde.ca.gov/schooldirectory/details?cdscode=43000000000000",
      cde(0),
    ),
    observedSource(
      "territory-gis",
      "https://gis.example.gov/district-boundary.json",
      gisText,
    ),
  ];
  const immutableOriginal = JSON.stringify(f.snapshot);
  f.rows.set(race.raceKey, {
    raceKey: race.raceKey,
    status: "complete",
    checkpoint: { releaseId, sourceCheckedAt: baseTime },
  });
  f.deps.now = () => observedAt;
  f.deps.saveSnapshot = async () => {
    snapshotWrites++;
  };
  f.deps.fetchRoster = async () => ({
    ...structuredClone(f.snapshot),
    source: { ...f.snapshot.source, fetchedAt: observedAt },
    certification: { ...f.snapshot.certification, fetchedAt: observedAt },
    additionalSources: [
      observedSource(
        "cde-profile",
        f.snapshot.additionalSources![0]!.url,
        cde(assetVersion),
      ),
      observedSource(
        "territory-gis",
        f.snapshot.additionalSources![1]!.url,
        gisText,
      ),
    ],
  });
  f.deps.readPublishedCoverage = async () => ({
    snapshotId: f.snapshot.id,
    races: [
      {
        contestId: race.contestId,
        jurisdiction: race.jurisdiction,
        electionDate: race.electionDate,
        releaseId,
        sourceCheckedAt: baseTime,
        policyVersion: "policy",
        members: race.members.map((member) => ({
          candidateId: member.candidateId,
          revisionId: randomUUID(),
          collectionId: null,
          author: null,
          reviewer: null,
        })),
      },
    ],
  });
  const savedBodies: unknown[] = [];
  const save = f.deps.saveArtifact;
  f.deps.saveArtifact = async (input) => {
    if (input.kind === "roster_source_archive")
      savedBodies.push(input.document);
    return save(input);
  };
  for (const [version, time] of [
    [1, "2026-10-30T13:00:00.000Z"],
    [2, "2026-10-30T14:00:00.000Z"],
  ] as const) {
    assetVersion = version;
    observedAt = time;
    const result = await reconcile(
      { snapshotId: f.snapshot.id, policyVersion: "policy", bounds },
      f.deps,
    );
    assert.equal(result.outcomes[0]!.status, "current");
  }
  assert.equal(snapshotWrites, 0);
  assert.equal(JSON.stringify(f.snapshot), immutableOriginal);
  assert.equal(f.stats.failures, 0);
  assert.equal(f.stats.authors, 0);
  const checks = [...f.artifacts.entries()].filter(([key]) =>
    key.startsWith("roster-check:"),
  );
  assert.equal(checks.length, 2);
  const documents = checks.map(
    ([, value]) =>
      value as {
        checkedAt: string;
        sources: { archiveKey: string; id: string; fetchedAt: string }[];
      },
  );
  assert.deepEqual(
    documents.map((value) => value.checkedAt),
    ["2026-10-30T13:00:00.000Z", "2026-10-30T14:00:00.000Z"],
  );
  assert.equal(
    documents[0]!.sources.find((source) => source.id === "territory-gis")!
      .archiveKey,
    documents[1]!.sources.find((source) => source.id === "territory-gis")!
      .archiveKey,
  );
  assert.notEqual(
    documents[0]!.sources.find((source) => source.id === "cde-profile")!
      .archiveKey,
    documents[1]!.sources.find((source) => source.id === "cde-profile")!
      .archiveKey,
  );
  assert.equal(
    savedBodies.filter((body) => (body as { text: string }).text === gisText)
      .length,
    1,
  );
  assert.ok(
    savedBodies.some((body) => (body as { text: string }).text === cde(1)),
  );
  assert.ok(
    savedBodies.some((body) => (body as { text: string }).text === cde(2)),
  );
  const publicCoverage = await coverage({ snapshotId: f.snapshot.id }, f.deps);
  assert.equal(publicCoverage.published.races, 1);
  assert.equal(publicCoverage.published.candidates, race.members.length);
});

test("a fresh checkpoint skips only while the exact release remains publicly available", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  const race = f.snapshot.races[0]!;
  const releaseId = randomUUID();
  let live = true;
  f.rows.set(race.raceKey, {
    raceKey: race.raceKey,
    status: "complete",
    checkpoint: { releaseId, sourceCheckedAt: f.deps.now() },
  });
  f.deps.readPublishedCoverage = async () => ({
    snapshotId: f.snapshot.id,
    races: live
      ? [
          {
            contestId: race.contestId,
            jurisdiction: race.jurisdiction,
            electionDate: race.electionDate,
            releaseId,
            sourceCheckedAt: f.deps.now(),
            policyVersion: "policy",
            members: race.members.map((member) => ({
              candidateId: member.candidateId,
              revisionId: randomUUID(),
              collectionId: null,
              author: null,
              reviewer: null,
            })),
          },
        ]
      : [],
  });
  const input = {
    snapshotId: f.snapshot.id,
    policyVersion: "policy",
    bounds: { ...bounds, maxRaces: 1 },
  };
  const healthy = await reconcile(input, f.deps);
  assert.equal(healthy.outcomes[0]!.status, "current");
  assert.equal(f.stats.investigations, 0);
  await assert.rejects(
    () => reconcile({ ...input, refreshCurrent: true }, f.deps),
    /explicit operator race keys/,
  );
  const refreshed = await reconcile(
    { ...input, raceKeys: [race.raceKey], refreshCurrent: true },
    f.deps,
  );
  assert.notEqual(refreshed.outcomes[0]?.status, "current");
  assert.equal(f.stats.investigations, race.members.length);
  f.stats.investigations = 0;
  live = false;
  const claim = f.deps.claim;
  f.deps.claim = async (input) => ({
    ...(await claim(input))!,
    reviewEpoch: 1,
  });
  const withdrawn = await reconcile(input, f.deps);
  assert.notEqual(withdrawn.outcomes[0]!.status, "current");
  assert.equal(f.stats.investigations, race.members.length);
});

test("permanently changed cited pages recover in the new review epoch without retrying the old baseline", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  const race = f.snapshot.races[0]!;
  let clock = f.deps.now(),
    version = 1,
    epoch = 0,
    live = false;
  let sharedSources = new Map<string, Promise<ResearchSource>>();
  const previousInputs: (string | null)[] = [];
  f.deps.now = () => clock;
  f.deps.fetchRoster = async () => ({
    ...f.snapshot,
    source: { ...f.snapshot.source, fetchedAt: clock },
    certification: { ...f.snapshot.certification, fetchedAt: clock },
  });
  const claim = f.deps.claim;
  f.deps.claim = async (input) => ({
    ...(await claim(input))!,
    reviewEpoch: epoch,
  });
  const publish = f.deps.publish;
  f.deps.publish = async (...args) => {
    live = true;
    return publish(...args);
  };
  f.deps.fail = async () => {
    f.stats.failures++;
    epoch++;
    live = false;
    const work = f.rows.get(race.raceKey);
    if (work) f.rows.set(race.raceKey, { ...work, status: "pending" });
  };
  const checkpoint = f.deps.checkpoint;
  f.deps.checkpoint = async (lease, status, value) =>
    lease.reviewEpoch === epoch ? checkpoint(lease, status, value) : false;
  f.deps.readPublishedCoverage = async () => {
    const saved = f.rows.get(race.raceKey)?.checkpoint as
      | CaliforniaWorkCheckpoint
      | undefined;
    return {
      snapshotId: f.snapshot.id,
      races:
        live && saved?.releaseId
          ? [
              {
                contestId: race.contestId,
                jurisdiction: race.jurisdiction,
                electionDate: race.electionDate,
                releaseId: saved.releaseId,
                sourceCheckedAt: saved.sourceCheckedAt ?? null,
                policyVersion: "policy",
                members: race.members.map((member) => {
                  const provenance =
                    saved.candidateProvenance?.[member.candidateId];
                  return {
                    candidateId: member.candidateId,
                    revisionId: provenance?.revisionId ?? randomUUID(),
                    collectionId: saved.collectionId ?? null,
                    author: provenance?.author ?? null,
                    reviewer: provenance?.reviewer ?? null,
                  };
                }),
              },
            ]
          : [],
    };
  };
  f.deps.investigate = async (input) => {
    f.stats.investigations++;
    previousInputs.push(input.previousDossier?.dossierDigest ?? null);
    return collectCaliforniaEvidence(input, {
      now: () => clock,
      sharedSources,
      budget: { request() {}, bytes() {} },
      search: async () => ({ sources: [] }),
      fetch: async (id, url, _publisher, format) => {
        const text = url.includes("voterguide.sos.ca.gov/candidates/")
          ? `${race.office} California 2026\nAs the state's chief executive officer, oversees most state departments and agencies, and appoints judges. Proposes new laws, approves or vetoes legislation, and submits the annual state budget to the Legislature. Mobilizes and directs state resources during emergencies.\n` +
            race.members
              .map(
                (member) =>
                  `${member.name} ${("I will support public schools through a published budget proposal and expand affordable college programs with measurable progress reports. Version " + version + ". ").repeat(5)}`,
              )
              .join("\n")
          : url.includes("contact-list")
            ? "Official contact fixture: no campaign website listed for these candidates."
            : "The Governor signs legislation, directs state departments, and submits budget proposals to the Legislature.";
        return {
          id,
          url,
          publisher: "Fixture official source",
          format,
          text,
          contentHash: hash(text),
          fetchedAt: clock,
        };
      },
    });
  };
  const input = {
    snapshotId: f.snapshot.id,
    policyVersion: "policy",
    bounds: { ...bounds, maxRaces: 1 },
  };
  const initial = await reconcile(input, f.deps);
  assert.equal(initial.completed, 1, JSON.stringify(initial));
  assert.equal(f.stats.authors, race.members.length);
  assert.equal(f.stats.reviews, race.members.length);
  const original = f.rows.get(race.raceKey)!
    .checkpoint as CaliforniaWorkCheckpoint;
  const originalRunIds = Object.values(original.candidateProvenance!).map(
    (item) => item.reviewer!.runId,
  );
  version = 2;
  clock = "2026-10-31T01:00:00.000Z";
  sharedSources = new Map();
  previousInputs.length = 0;
  const changed = await reconcile(input, f.deps);
  assert.equal(changed.blocked, 1, JSON.stringify(changed));
  assert.equal(epoch, 1);
  assert.equal(live, false);
  assert.equal(f.stats.failures, 1);
  assert.equal(f.stats.authors, race.members.length);
  assert.ok(previousInputs[0]);
  sharedSources = new Map();
  previousInputs.length = 0;
  const recovered = await reconcile(input, f.deps);
  assert.equal(recovered.completed, 1, JSON.stringify(recovered));
  assert.deepEqual(
    previousInputs,
    race.members.map(() => null),
  );
  assert.equal(f.stats.authors, race.members.length * 2);
  assert.equal(f.stats.reviews, race.members.length * 2);
  assert.equal(live, true);
  const current = f.rows.get(race.raceKey)!
    .checkpoint as CaliforniaWorkCheckpoint;
  assert.deepEqual(
    Object.values(current.dossierReviewEpochs!),
    race.members.map(() => 1),
  );
  for (const item of Object.values(current.candidateProvenance!)) {
    assert.equal(originalRunIds.includes(item.reviewer!.runId), false);
  }
  clock = "2026-10-31T14:00:00.000Z";
  f.deps.authorConfigurationKey = "provider-reconfiguration";
  let uncertainCalls = 0;
  f.deps.author = async () => {
    uncertainCalls++;
    throw Error("provider transport outcome unknown");
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    sharedSources = new Map();
    const pending = await reconcile(input, f.deps);
    assert.equal(pending.blocked, 1);
  }
  assert.equal(uncertainCalls, 1);
  assert.equal(epoch, 1);
  assert.equal(f.stats.failures, 1);
  assert.equal(live, true);
});

test("all-gap author drafts exhaust one correction and remain private without reviewing or withdrawing healthy coverage", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  const race = f.snapshot.races[0]!;
  const releaseId = randomUUID();
  const checkedAt = "2026-10-29T23:00:00.000Z";
  f.rows.set(race.raceKey, {
    raceKey: race.raceKey,
    status: "complete",
    checkpoint: { releaseId, sourceCheckedAt: checkedAt },
  });
  f.deps.readPublishedCoverage = async () => ({
    snapshotId: f.snapshot.id,
    races: [
      {
        contestId: race.contestId,
        jurisdiction: race.jurisdiction,
        electionDate: race.electionDate,
        releaseId,
        sourceCheckedAt: checkedAt,
        policyVersion: "policy",
        members: race.members.map((member) => ({
          candidateId: member.candidateId,
          revisionId: randomUUID(),
          collectionId: null,
          author: null,
          reviewer: null,
        })),
      },
    ],
  });
  const author = f.deps.author;
  f.deps.author = async (input) => {
    const output = await author(input);
    const brief = {
      ...output.brief,
      sections: output.brief.sections.map((section) => ({
        ...section,
        claims: [],
        missingEvidence:
          "The checked sources did not support a candidate-specific account.",
      })),
    };
    return {
      brief,
      attestation: {
        ...output.attestation,
        revisionDigest: evidenceDigest(brief),
      },
    };
  };
  let collections = 0;
  f.deps.saveCollection = async (document) => {
    collections++;
    return {
      collectionId: document.manifest.id,
      changed: true,
      checkedAt: document.manifest.sourceCheckedAt,
    };
  };
  const input = {
    snapshotId: f.snapshot.id,
    policyVersion: "policy",
    bounds: { ...bounds, maxRaces: 1 },
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await reconcile(input, f.deps);
    assert.equal(result.outcomes[0]!.status, "pending");
    assert.equal(result.completed, 0);
    assert.equal(result.blocked, 0);
    assert.equal(result.remaining, 1);
    assert.equal(result.usage.modelCalls, attempt === 0 ? 2 : 0);
  }
  assert.equal(f.stats.authors, 2);
  assert.equal(f.stats.reviews, 0);
  assert.equal(f.stats.releases, 0);
  assert.equal(f.stats.failures, 0);
  assert.equal(collections, 0);
  assert.equal(
    [...f.artifacts.keys()].filter((key) => key.startsWith("author:")).length,
    1,
  );
  assert.equal(
    [...f.artifacts.keys()].filter((key) =>
      key.startsWith("author-correction:"),
    ).length,
    1,
  );
  assert.equal(
    [...f.artifacts.keys()].filter((key) => key.startsWith("correction-plan:"))
      .length,
    1,
  );
  assert.equal(
    [...f.artifacts.keys()].some((key) => key.startsWith("dispatch:review:")),
    false,
  );
  const checkpoint = f.rows.get(race.raceKey)!
    .checkpoint as CaliforniaWorkCheckpoint;
  assert.equal(checkpoint.releaseId, releaseId);
  assert.ok(
    checkpoint.candidateProvenance?.[race.members[0]!.candidateId]?.author,
  );
  const current = await coverage({ snapshotId: f.snapshot.id }, f.deps);
  assert.equal(current.published.races, 1);
  assert.equal(current.published.candidates, race.members.length);
});

test("a 23-hour source observation leaves one hour and an unchanged fresh retrieval renews without new model calls", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  const now = f.deps.now();
  const aged = new Date(Date.parse(now) - 23 * 60 * 60 * 1000).toISOString();
  let observedAt = aged;
  const geometry = JSON.stringify({ type: "FeatureCollection", features: [] });
  f.snapshot.additionalSources = [
    {
      id: "required-territory",
      url: "https://fixture.example.gov/current-boundary.json",
      publisher: "Synthetic required source",
      format: "json",
      text: geometry,
      contentHash: hash(geometry),
      fetchedAt: aged,
    },
  ];
  f.snapshot.historicalSources = [
    {
      id: "historical-identity",
      url: "https://fixture.example.gov/archived-filing.pdf",
      publisher: "Synthetic historical source",
      format: "pdf",
      text: "Historical identity bridge only",
      contentHash: hash("Historical identity bridge only"),
      fetchedAt: "2020-01-01T00:00:00.000Z",
    },
  ];
  f.deps.fetchRoster = async () => ({
    ...f.snapshot,
    additionalSources: f.snapshot.additionalSources!.map((source) => ({
      ...source,
      fetchedAt: observedAt,
    })),
  });
  const investigate = f.deps.investigate;
  f.deps.investigate = async (...args) => {
    const dossier = await investigate(...args);
    return buildCaliforniaDossier({
      ...dossier,
      sources: dossier.sources.map((source) => ({
        ...source,
        fetchedAt: source.id.startsWith("candidate-record:")
          ? observedAt
          : source.fetchedAt,
      })),
    });
  };
  const documents: CandidateResearchCollectionDocument[] = [];
  const collectionId = randomUUID();
  f.deps.saveCollection = async (document) => {
    documents.push(document);
    return {
      collectionId,
      changed: documents.length === 1,
      checkedAt: document.manifest.sourceCheckedAt,
    };
  };
  const input = {
    snapshotId: f.snapshot.id,
    policyVersion: "policy",
    bounds: { ...bounds, maxRaces: 1 },
  };
  assert.equal((await reconcile(input, f.deps)).completed, 1);
  assert.equal(documents[0]!.manifest.rosterVerifiedAt, aged);
  assert.equal(documents[0]!.manifest.sourceCheckedAt, aged);
  assert.equal(
    Date.parse(documents[0]!.manifest.expiresAt) - Date.parse(now),
    60 * 60 * 1000,
  );
  const authored = f.stats.authors,
    reviewed = f.stats.reviews;
  observedAt = now;
  const renewed = await reconcile(input, f.deps);
  assert.equal(renewed.completed, 1);
  assert.equal(renewed.usage.modelCalls, 0);
  assert.equal(f.stats.authors, authored);
  assert.equal(f.stats.reviews, reviewed);
  assert.equal(documents[1]!.manifest.rosterVerifiedAt, now);
  assert.equal(documents[1]!.manifest.sourceCheckedAt, now);
  assert.equal(
    Date.parse(documents[1]!.manifest.expiresAt) - Date.parse(now),
    24 * 60 * 60 * 1000,
  );
  assert.equal(
    documents[1]!.briefs[0]!.revisionId,
    documents[0]!.briefs[0]!.revisionId,
  );
  assert.equal(
    documents[1]!.briefs[0]!.evidence.find(
      (evidence) => evidence.id === "candidate-record",
    )!.retrievedAt,
    aged,
  );
  assert.equal(
    documents[1]!.sources.find((source) =>
      source.id.startsWith("candidate-record:"),
    )!.fetchedAt,
    now,
  );
  assert.equal(
    (
      f.rows.get(f.snapshot.races[0]!.raceKey)!
        .checkpoint as CaliforniaWorkCheckpoint
    ).sourceCheckedAt,
    now,
  );
});

test("checkpoints use the effective checked time returned by the trusted store", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  const bound = new Date(
    Date.parse(f.deps.now()) - 4 * 60 * 60 * 1000,
  ).toISOString();
  f.deps.saveCollection = async (document) => ({
    collectionId: document.manifest.id,
    changed: true,
    checkedAt: bound,
  });
  const result = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      bounds: { ...bounds, maxRaces: 1 },
    },
    f.deps,
  );
  assert.equal(result.completed, 1);
  assert.equal(
    (
      f.rows.get(f.snapshot.races[0]!.raceKey)!
        .checkpoint as CaliforniaWorkCheckpoint
    ).sourceCheckedAt,
    bound,
  );
});

test("sparse no-finance dossiers stay pending before any dispatch and retain healthy public coverage", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  const race = f.snapshot.races[0]!;
  const releaseId = randomUUID();
  const checkedAt = "2026-10-29T23:00:00.000Z";
  f.rows.set(race.raceKey, {
    raceKey: race.raceKey,
    status: "complete",
    checkpoint: { releaseId, sourceCheckedAt: checkedAt },
  });
  f.deps.readPublishedCoverage = async () => ({
    snapshotId: f.snapshot.id,
    races: [
      {
        contestId: race.contestId,
        jurisdiction: race.jurisdiction,
        electionDate: race.electionDate,
        releaseId,
        sourceCheckedAt: checkedAt,
        policyVersion: "policy",
        members: race.members.map((member) => ({
          candidateId: member.candidateId,
          revisionId: randomUUID(),
          collectionId: null,
          author: null,
          reviewer: null,
        })),
      },
    ],
  });
  const investigate = f.deps.investigate;
  f.deps.investigate = async (...args) => {
    const dossier = await investigate(...args);
    return buildCaliforniaDossier({
      ...dossier,
      evidence: dossier.evidence.filter(
        (evidence) => evidence.role === "roster",
      ),
      sources: dossier.sources.filter((source) => source.id === "roster"),
      finance: null,
    });
  };
  let dispatches = 0;
  f.deps.reserveDispatch = async () => {
    dispatches++;
    return true;
  };
  const result = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      bounds: { ...bounds, maxRaces: 1 },
    },
    f.deps,
  );
  assert.equal(result.outcomes[0]!.status, "pending");
  assert.equal(result.usage.modelCalls, 0);
  assert.equal(dispatches, 0);
  assert.equal(f.stats.authors, 0);
  assert.equal(f.stats.reviews, 0);
  assert.equal(f.stats.releases, 0);
  assert.equal(f.stats.failures, 0);
  assert.equal(
    [...f.artifacts.keys()].some(
      (key) =>
        key.startsWith("author:") ||
        key.startsWith("review:") ||
        key.startsWith("dispatch:"),
    ),
    false,
  );
  assert.equal(
    (f.rows.get(race.raceKey)!.checkpoint as CaliforniaWorkCheckpoint)
      .releaseId,
    releaseId,
  );
  assert.equal(
    (await coverage({ snapshotId: f.snapshot.id }, f.deps)).published.races,
    1,
  );
});

test("a substantive typed finance-only dossier still dispatches the author dependency", async () => {
  const f = await fixture();
  const race = f.allRaces.find((race) =>
    race.members.some((member) => member.name === "Mike McGuire"),
  )!;
  f.snapshot.races = [race];
  let substantive = false;
  const investigate = f.deps.investigate;
  f.deps.investigate = async (...args) => {
    const base = await investigate(...args);
    const now = f.deps.now();
    const indexText = JSON.stringify({
      results: [
        {
          candidate_id: "H6CA01269",
          name: "MCGUIRE, MIKE",
          office: "H",
          state: "CA",
          district: "01",
          cycles: [2026],
          election_years: [2026],
        },
      ],
    });
    const filingText = JSON.stringify({
      committee_id: "C00000001",
      total_receipts: 100,
      period_start: "2025-01-01",
      period_end: "2026-09-30",
    });
    const index: ResearchSource = {
      id: "finance-index",
      url: "https://api.open.fec.gov/v1/candidates/search/?office=H&state=CA&district=01&election_year=2026",
      publisher: "Synthetic FEC identity fixture",
      format: "json",
      text: indexText,
      contentHash: hash(indexText),
      fetchedAt: now,
    };
    const filing: ResearchSource = {
      id: "finance-filing",
      url: "https://www.fec.gov/data/candidate/H6CA01269/?cycle=2026",
      publisher: "Synthetic FEC finance fixture",
      format: "json",
      text: filingText,
      contentHash: hash(filingText),
      fetchedAt: now,
    };
    return buildCaliforniaDossier({
      ...base,
      officeKind: "federal_legislative",
      sources: [
        ...base.sources.filter((source) => source.id === "roster"),
        index,
        filing,
      ],
      evidence: [
        ...base.evidence.filter((evidence) => evidence.role === "roster"),
        {
          id: "filing",
          sourceId: filing.id,
          excerpt: filing.text,
          locator: "Synthetic filing",
          origin: "primary_record",
          role: "finance",
          identityQualification: "exact_election_office",
        },
      ],
      financeIdentityProof: {
        candidateId: "H6CA01269",
        name: "MCGUIRE, MIKE",
        office: "H",
        state: "CA",
        district: "01",
        cycle: 2026,
        sourceId: index.id,
        sourceHash: index.contentHash,
      },
      finance: {
        committeeId: "C00000001",
        committeeName: "Synthetic fixture committee",
        periodStart: "2025-01-01",
        periodEnd: "2026-09-30",
        currency: "USD",
        coverage: "partial",
        coverageNote: "Synthetic reconciled filing fixture",
        updatedAt: now,
        filingEvidenceIds: ["filing"],
        receipts: substantive
          ? {
              totalCents: 10000,
              breakdown: {
                individuals: 10000,
                committees: 0,
                self_contributions: 0,
                candidate_loans: 0,
                transfers: 0,
                other: 0,
              },
              refundsCents: null,
            }
          : null,
        donors: [],
        donorCoverage: "unavailable",
        outsideSpending: null,
      },
    });
  };
  f.deps.author = async ({ dossier }) => {
    assert.equal(dossier.classification, "evidence_gap");
    assert.equal(dossier.finance?.receipts?.totalCents, 10000);
    f.stats.authors++;
    throw Error("Author dependency invoked; no provider call in fixture");
  };
  const metadataOnly = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      bounds: { ...bounds, maxRaces: 1 },
    },
    f.deps,
  );
  assert.equal(metadataOnly.outcomes[0]!.status, "pending");
  assert.equal(metadataOnly.usage.modelCalls, 0);
  assert.equal(f.stats.authors, 0);
  substantive = true;
  const invoked = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      bounds: { ...bounds, maxRaces: 1 },
    },
    f.deps,
  );
  assert.equal(invoked.usage.modelCalls, 1);
  assert.equal(f.stats.authors, 1);
  assert.equal(f.stats.reviews, 0);
  assert.equal(f.stats.releases, 0);
});

test("terminal author validation feedback produces one corrected independently reviewed revision", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  const author = f.deps.author;
  let calls = 0;
  const previousOutput = {
    chapters: [
      {
        topic: "record",
        claims: [{ kind: "fact", text: "Campaign statement" }],
      },
    ],
  };
  f.deps.author = async (input) => {
    calls++;
    if (calls === 1) {
      throw new CaliforniaModelInvocationError({
        role: "author",
        errorKind: "schema_validation",
        configuredModel: "fixture",
        actualModel: "fixture",
        provider: "fixture",
        requestId: "terminal-request",
        rawText: JSON.stringify(previousOutput),
        parsedOutput: previousOutput,
        validationProblems: ["record fact must cite a primary record"],
        finishReason: "stop",
        startedAt: f.deps.now(),
        completedAt: f.deps.now(),
        costUsd: null,
        usage: {
          inputTokens: 123,
          outputTokens: 45,
          totalTokens: 168,
          inputTokenDetails: {
            noCacheTokens: 123,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokenDetails: { textTokens: 45, reasoningTokens: 0 },
        },
      });
    }
    if (calls === 2) {
      assert.deepEqual(
        (input as unknown as { correction: unknown }).correction,
        {
          kind: "author_validation",
          previousOutput,
          validationProblems: ["record fact must cite a primary record"],
        },
      );
    }
    return author(input);
  };
  const result = await reconcile(
    { snapshotId: f.snapshot.id, policyVersion: "policy", bounds },
    f.deps,
  );
  assert.equal(result.completed, 1, JSON.stringify(result));
  assert.equal(calls, f.snapshot.races[0]!.members.length + 1);
  assert.equal(f.stats.reviews, f.snapshot.races[0]!.members.length);
  assert.equal(result.usage.actualInputTokens, 123 + f.stats.authors * 200);
  const second = await reconcile(
    { snapshotId: f.snapshot.id, policyVersion: "policy", bounds },
    f.deps,
  );
  assert.equal(second.usage.modelCalls, 0);
});

test("actual whole-brief rejection feeds one replacement and independently reviews the replacement", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  const author = f.deps.author,
    review = f.deps.review;
  let rejectedBrief: CandidateBrief | undefined;
  let correctionSeen = false;
  const reviewedRevisions: string[] = [];
  f.deps.author = async (input) => {
    const correction = (
      input as unknown as {
        correction?: {
          kind: string;
          previousBrief: CandidateBrief;
          overallReason: string;
          findings: unknown[];
        };
      }
    ).correction;
    if (correction) {
      correctionSeen = true;
      assert.equal(correction.kind, "review_rejection");
      assert.deepEqual(correction.previousBrief, rejectedBrief);
      assert.equal(
        correction.overallReason,
        "The record chapter misattributes the campaign's statement to the official record.",
      );
      assert.deepEqual(correction.findings, []);
    }
    return author(input);
  };
  f.deps.review = async (input) => {
    reviewedRevisions.push(input.brief.revisionId);
    const result = await review(input);
    if (!rejectedBrief) {
      rejectedBrief = input.brief;
      return {
        ...result,
        verdict: "reject",
        overallReason:
          "The record chapter misattributes the campaign's statement to the official record.",
      };
    }
    return result;
  };
  const result = await reconcile(
    { snapshotId: f.snapshot.id, policyVersion: "policy", bounds },
    f.deps,
  );
  assert.equal(result.completed, 1, JSON.stringify(result));
  assert.equal(correctionSeen, true);
  assert.notEqual(reviewedRevisions[0], reviewedRevisions[1]);
  assert.equal(f.stats.reviews, f.snapshot.races[0]!.members.length + 1);
});

test("source failure atomically preserves attempted provenance before fencing and lets the next bounded run progress", async () => {
  const f = await fixture();
  const race = [...f.snapshot.races].sort((a, b) =>
    a.raceKey.localeCompare(b.raceKey),
  )[0]!;
  const investigate = f.deps.investigate,
    checkpoint = f.deps.checkpoint;
  let epoch = 0,
    staleCheckpoints = 0;
  const investigated: string[] = [];
  const claim = f.deps.claim;
  f.deps.claim = async (input) => ({
    ...(await claim(input))!,
    reviewEpoch: epoch,
  });
  f.deps.investigate = async (input, budget) => {
    investigated.push(input.race.raceKey);
    if (
      input.race.raceKey === race.raceKey &&
      input.member.candidateId === race.members[1]!.candidateId
    )
      throw new CaliforniaCitedSourceFailure(
        "Required candidate source changed",
      );
    return investigate(input, budget);
  };
  f.deps.checkpoint = async (lease, status, value) => {
    if (lease.reviewEpoch !== epoch) {
      staleCheckpoints++;
      return false;
    }
    return checkpoint(lease, status, value);
  };
  f.deps.fail = async (...args) => {
    const [key, , lease, attempted] = args as unknown as [
      string,
      string,
      { reviewEpoch: number },
      CaliforniaWorkCheckpoint | undefined,
    ];
    assert.equal(lease.reviewEpoch, epoch);
    if (attempted)
      f.rows.set(key, {
        raceKey: key,
        status: "pending",
        checkpoint: attempted,
      });
    epoch++;
  };
  const input = {
    snapshotId: f.snapshot.id,
    policyVersion: "policy",
    bounds: { ...bounds, maxRaces: 1 },
  };
  const first = await reconcile(input, f.deps);
  assert.equal(first.blocked, 1);
  const attempted = f.rows.get(race.raceKey)?.checkpoint as
    | CaliforniaWorkCheckpoint
    | undefined;
  assert.equal(attempted?.attemptedAt, f.deps.now());
  assert.ok(
    attempted?.candidateProvenance?.[race.members[0]!.candidateId]?.author,
  );
  assert.equal(staleCheckpoints, 0);
  investigated.length = 0;
  const second = await reconcile(input, f.deps);
  assert.equal(second.completed, 1, JSON.stringify(second));
  assert.ok(investigated.every((key) => key !== race.raceKey));
});

test("a recovered first candidate cannot publish an incomplete race", async () => {
  const f = await fixture();
  f.snapshot.races.splice(1);
  const review = f.deps.review;
  let rejected = false;
  f.deps.review = async (input) => {
    const result = await review(input);
    if (!rejected) {
      rejected = true;
      return {
        ...result,
        verdict: "reject",
        overallReason:
          "The record chapter assigns the committee's action to the candidate without source support.",
      };
    }
    return result;
  };
  const result = await reconcile(
    {
      snapshotId: f.snapshot.id,
      policyVersion: "policy",
      bounds: { ...bounds, maxModelCalls: 4 },
    },
    f.deps,
  );
  assert.equal(f.stats.authors, 2);
  assert.equal(f.stats.reviews, 2);
  assert.equal(result.remaining, 1);
  assert.equal(result.completed, 0);
  assert.equal(f.stats.releases, 0);
});

test("an ordinary failed checkpoint surfaces lease loss instead of claiming a saved failure", async () => {
  const f = await fixture();
  f.deps.author = async () => {
    throw Error("Unknown transport failure");
  };
  f.deps.checkpoint = async () => false;
  await assert.rejects(
    reconcile(
      { snapshotId: f.snapshot.id, policyVersion: "policy", bounds },
      f.deps,
    ),
    /lease expired before failure checkpoint/,
  );
  assert.equal(f.stats.releases, 0);
});

for (const failure of [
  "request",
  "body",
  "dns",
  408,
  429,
  500,
  502,
  503,
  504,
] as const) {
  test(`temporary shared roster acquisition failure ${failure} preserves published-state authorization`, async () => {
    const f = await fixture();
    const network = Object.assign(
      new Error("connection reset during acquisition"),
      { code: "ECONNRESET" },
    );
    let caught: unknown;
    try {
      await fetchBoundedCaliforniaSource(
        "required-roster",
        "https://county.example.gov/roster",
        "County",
        "text",
        { request() {}, bytes() {} },
        undefined,
        {
          addresses: async () => {
            if (failure === "dns")
              throw Object.assign(new Error("DNS temporarily unavailable"), {
                code: "EAI_AGAIN",
              });
            return [{ address: "93.184.216.34", family: 4 }];
          },
          transport: async () => {
            if (failure === "request") throw network;
            if (failure === "body")
              return new Response(
                new ReadableStream({
                  start(controller) {
                    controller.error(network);
                  },
                }),
              );
            return new Response(
              failure === 503
                ? new ReadableStream({
                    start(controller) {
                      controller.error(network);
                    },
                  })
                : null,
              {
                status: typeof failure === "number" ? failure : 503,
              },
            );
          },
        },
      );
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof Error);
    f.deps.fetchRoster = async () => {
      throw caught;
    };
    await assert.rejects(
      () =>
        reconcile(
          { snapshotId: f.snapshot.id, policyVersion: "policy", bounds },
          f.deps,
        ),
      (error) => error === caught,
    );
    assert.equal(f.stats.failures, 0);
    assert.equal(f.stats.investigations, 0);
    assert.equal(f.stats.authors, 0);
    assert.equal(f.rows.size, 0);
  });
}

for (const status of [401, 403, 404, 410]) {
  test(`nontransient shared roster HTTP ${status} still invalidates election research`, async () => {
    const f = await fixture();
    f.deps.fetchRoster = async () =>
      fetchBoundedCaliforniaSource(
        "required",
        "https://county.example.gov/roster",
        "County",
        "text",
        { request() {}, bytes() {} },
        undefined,
        {
          addresses: async () => [{ address: "93.184.216.34", family: 4 }],
          transport: async () => new Response(null, { status }),
        },
      ) as never;
    await assert.rejects(() =>
      reconcile(
        { snapshotId: f.snapshot.id, policyVersion: "policy", bounds },
        f.deps,
      ),
    );
    assert.equal(f.stats.failures, 1);
    assert.equal(f.stats.authors, 0);
  });
}

for (const failure of [
  "malformed-json",
  "private-address",
  "tls-identity",
  "mixed-network-tls",
  "tls-with-network-cause",
  "unknown-aborted",
  "budget",
] as const) {
  test(`shared roster ${failure} retains its existing invalidation or budget behavior`, async () => {
    const f = await fixture();
    f.deps.fetchRoster = async () => {
      if (failure === "unknown-aborted") throw new Error("aborted");
      return (await fetchBoundedCaliforniaSource(
        "required",
        "https://county.example.gov/roster",
        "County",
        failure === "malformed-json" ? "json" : "text",
        {
          request() {},
          bytes() {
            if (failure === "budget")
              throw new CaliforniaBudgetReached("source bytes");
          },
        },
        undefined,
        {
          addresses: async () => {
            if (failure === "private-address")
              throw new Error("Private source addresses are not permitted");
            return [{ address: "93.184.216.34", family: 4 }];
          },
          transport: async () => {
            if (
              failure === "tls-identity" ||
              failure === "tls-with-network-cause"
            )
              throw Object.assign(
                new Error("certificate hostname mismatch", {
                  cause:
                    failure === "tls-with-network-cause"
                      ? Object.assign(new Error("connection reset"), {
                          code: "ECONNRESET",
                        })
                      : undefined,
                }),
                {
                  code: "ERR_TLS_CERT_ALTNAME_INVALID",
                },
              );
            if (failure === "mixed-network-tls")
              throw new AggregateError([
                Object.assign(new Error("network failure"), {
                  code: "ENETUNREACH",
                }),
                Object.assign(new Error("certificate hostname mismatch"), {
                  code: "ERR_TLS_CERT_ALTNAME_INVALID",
                }),
              ]);
            if (failure === "budget")
              return new Response(
                new ReadableStream({
                  start(controller) {
                    controller.enqueue(
                      new TextEncoder().encode(
                        "A source chunk reaching byte accounting.",
                      ),
                    );
                  },
                  cancel() {
                    throw new Error(
                      "cleanup failure must not replace the source budget",
                    );
                  },
                }),
              );
            return new Response("This is deliberately malformed source JSON.");
          },
        },
      )) as never;
    };
    await assert.rejects(() =>
      reconcile(
        { snapshotId: f.snapshot.id, policyVersion: "policy", bounds },
        f.deps,
      ),
    );
    assert.equal(f.stats.failures, failure === "budget" ? 0 : 1);
    assert.equal(f.stats.authors, 0);
  });
}

for (const failure of ["request", "body", 429, 503] as const) {
  test(`raw SOS roster ${failure} acquisition failure preserves existing publication`, async (t) => {
    const f = await fixture();
    const network = Object.assign(new Error("raw roster connection reset"), {
      code: "ECONNRESET",
    });
    t.mock.method(globalThis, "fetch", async () => {
      if (failure === "request")
        throw new TypeError("fetch failed", { cause: network });
      if (failure === "body")
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.error(network);
            },
          }),
        );
      return new Response(
        failure === 503
          ? new ReadableStream({
              start(controller) {
                controller.error(network);
              },
            })
          : null,
        { status: failure },
      );
    });
    f.deps.fetchRoster = fetchCaliforniaPlan;
    await assert.rejects(() =>
      reconcile(
        { snapshotId: f.snapshot.id, policyVersion: "policy", bounds },
        f.deps,
      ),
    );
    assert.equal(f.stats.failures, 0);
    assert.equal(f.stats.authors, 0);
    assert.equal(f.rows.size, 0);
  });
}

test("changed complete SOS roster bytes remain invalidating when certification acquisition fails", async (t) => {
  const f = await fixture();
  const changed = f.snapshot.source.text.replace("C26GG", "C26GX") + "\n";
  const calls: string[] = [];
  const originalRequest = https.request;
  const originalLookup = dns.lookup;
  Object.defineProperty(dns, "lookup", {
    configurable: true,
    writable: true,
    value: async () => [{ address: "93.184.216.34", family: 4 }],
  });
  Object.defineProperty(https, "request", {
    configurable: true,
    writable: true,
    value: () => {
      calls.push("certification-transport");
      throw Object.assign(new Error("certification temporarily down"), {
        code: "ECONNRESET",
      });
    },
  });
  syncBuiltinESMExports();
  t.after(() => {
    https.request = originalRequest;
    dns.lookup = originalLookup;
    syncBuiltinESMExports();
  });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url === "https://media.sos.ca.gov/media/C26GG.txt")
      return new Response(changed);
    throw Object.assign(new Error("certification temporarily down"), {
      code: "ECONNRESET",
    });
  });
  f.deps.fetchRoster = fetchCaliforniaPlan;
  await assert.rejects(
    () =>
      reconcile(
        { snapshotId: f.snapshot.id, policyVersion: "policy", bounds },
        f.deps,
      ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(
        error.message,
        /Changed authoritative SOS roster remains unverified/,
      );
      assert.ok(error.cause instanceof Error);
      assert.equal(error.cause.name, "CaliforniaSourceUnavailable");
      return true;
    },
  );
  assert.equal(f.stats.failures, 1);
  assert.equal(f.stats.authors, 0);
  assert.deepEqual(calls, [
    "https://media.sos.ca.gov/media/C26GG.txt",
    "certification-transport",
  ]);
});

test("raw SOS byte budget remains the failure when cancellation cleanup also fails", async (t) => {
  const f = await fixture();
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(bounds.maxSourceBytes + 1));
          },
          cancel() {
            throw new Error("cleanup failure must not replace accounting");
          },
        }),
      ),
  );
  f.deps.fetchRoster = fetchCaliforniaPlan;
  await assert.rejects(
    () =>
      reconcile(
        { snapshotId: f.snapshot.id, policyVersion: "policy", bounds },
        f.deps,
      ),
    (error) => error instanceof CaliforniaBudgetReached,
  );
  assert.equal(f.stats.failures, 0);
  assert.equal(f.stats.authors, 0);
});

for (const changed of ["none", "roster", "certification"] as const) {
  test(`completed ${changed} statewide observation before a local acquisition outage retains its authority meaning`, async () => {
    const f = await fixture();
    const state = structuredClone(f.snapshot);
    if (changed === "roster") {
      state.source.text += "\n";
      state.source.textHash = hash(state.source.text);
    } else if (changed === "certification") {
      state.certification.text += "\n";
      state.certification.textHash = hash(state.certification.text);
    }
    f.snapshot.scope = "ca_sos_certified_and_san_jose";
    const localSource: ResearchSource = {
      id: "san-jose-qualified-roster",
      url: "https://county.example.gov/qualified.pdf",
      publisher: "County",
      format: "pdf",
      text: "Synthetic local roster source for acquisition failure fixture",
      contentHash: hash(
        "Synthetic local roster source for acquisition failure fixture",
      ),
      fetchedAt: f.deps.now(),
    };
    f.snapshot.additionalSources = [localSource];
    f.snapshot.localCrosswalk = {
      schemaVersion: 1,
      electionDate: "2026-11-03",
      rosterSourceHash: localSource.contentHash,
      method: "Synthetic crosswalk for a failure before proof validation.",
      entries: Array.from({ length: 129 }, (_, i) => ({
        sourceContestId: String(i),
        status: "pending" as const,
        reason: "Synthetic failure fixture only.",
        proofs: [
          { url: localSource.url, contentHash: localSource.contentHash },
        ],
      })),
      review: {
        digest: hash("fixture review"),
        actorId: "fixture-reviewer",
        reviewedAt: f.deps.now(),
      },
    };
    let outage: unknown;
    try {
      await fetchBoundedCaliforniaSource(
        "required",
        localSource.url,
        "County",
        "text",
        { request() {}, bytes() {} },
        undefined,
        {
          addresses: async () => [{ address: "93.184.216.34", family: 4 }],
          transport: async () => {
            throw Object.assign(new Error("connection reset"), {
              code: "ECONNRESET",
            });
          },
        },
      );
    } catch (error) {
      outage = error;
    }
    assert.ok(outage instanceof Error);
    let localFetches = 0;
    f.deps.fetchRoster = async () => state;
    f.deps.fetchProof = async () => {
      localFetches++;
      throw outage;
    };
    await assert.rejects(
      () =>
        reconcile(
          { snapshotId: f.snapshot.id, policyVersion: "policy", bounds },
          f.deps,
        ),
      (error: unknown) => {
        if (changed === "none") assert.equal(error, outage);
        else {
          assert.ok(error instanceof Error);
          assert.match(
            error.message,
            /Changed statewide roster authority remains unverified/,
          );
          assert.equal(error.cause, outage);
        }
        return true;
      },
    );
    assert.equal(localFetches, 1);
    assert.equal(f.stats.failures, changed === "none" ? 0 : 1);
    assert.equal(f.stats.authors, 0);
    assert.equal(f.rows.size, 0);
  });
}
