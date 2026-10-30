import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type {
  CandidateBrief,
  CandidateEvidenceDossier,
  CandidateModelAttestation,
  ResearchSource,
} from "@acme/validators";
import {
  candidateBriefSchema,
  candidateEvidenceDossierSchema,
} from "@acme/validators";

import type { CaliforniaBounds, CaliforniaDependencies } from "./california.js";
import { californiaInvocationFailure } from "./california-ai.js";
import {
  buildCaliforniaDossier,
  evidenceDigest,
} from "./california-dossier.js";
import { CaliforniaCitedSourceFailure } from "./california-evidence.js";
import { decodeCaliforniaRoster } from "./california-roster.js";
import { coverage, plan, reconcile } from "./california.js";

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
        ],
        gaps: [],
      });
    },
    author: async ({ dossier }) => {
      stats.authors++;
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
        evidence: dossier.evidence.map((e) => ({
          id: e.id,
          url: dossier.sources[0]!.url,
          publisher: "SOS",
          locator: e.locator,
          retrievedAt: now,
          documentDate: null,
          contentHash: dossier.sources[0]!.contentHash,
          excerpt: e.excerpt,
          origin: e.origin,
        })),
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
            "No additional candidate-specific evidence was located in the checked sources.",
          claims: [],
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
  return { deps, snapshot, stats, artifacts, rows };
}
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
    return { collectionId: document.manifest.id, changed: true };
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
    return { collectionId: document.manifest.id, changed: true };
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
