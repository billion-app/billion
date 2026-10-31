import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { CandidateEvidenceDossier } from "@acme/validators";
import { hasSubstantiveCandidateResearch } from "@acme/validators";

import type { CaliforniaModelFailureDiagnostic } from "./california-ai.js";
import {
  authorCaliforniaBrief,
  californiaAuthorEvidence,
  californiaAuthorOutputSchema,
  californiaModelInput,
  CaliforniaModelInvocationError,
} from "./california-ai.js";
import {
  PendingCandidateResearchGap,
  prepareReviewedCaliforniaCandidate,
  reviewPreparedCaliforniaCandidateForCollection,
} from "./california-candidate-preparation.js";
import {
  buildCaliforniaDossier,
  evidenceDigest,
} from "./california-dossier.js";
import {
  fixtureCampaignMaterialDossier,
  fixtureDossier,
} from "./california-dossier.test.js";

type Input = Parameters<typeof prepareReviewedCaliforniaCandidate>[0];
type Dependencies = Parameters<typeof prepareReviewedCaliforniaCandidate>[1];
function diagnostic(
  overrides: Partial<CaliforniaModelFailureDiagnostic> = {},
): CaliforniaModelFailureDiagnostic {
  return {
    role: "author",
    errorKind: "schema_validation",
    configuredModel: "fixture",
    actualModel: "fixture",
    provider: "fixture",
    requestId: "terminal-response",
    rawText: '{"bad":"fact"}',
    parsedOutput: { bad: "fact" },
    validationProblems: ["record fact must cite a primary record"],
    finishReason: "stop",
    startedAt: "2026-10-30T00:00:00.000Z",
    completedAt: "2026-10-30T00:00:01.000Z",
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
    ...overrides,
  };
}
function fixture() {
  const dossier = fixtureDossier();
  const artifacts = new Map<string, unknown>();
  const calls: { role: string; correction?: unknown }[] = [];
  const deps: Dependencies = {
    now: () => "2026-10-30T00:00:00.000Z",
    artifact: async (key) => artifacts.get(key) ?? null,
    saveArtifact: async ({ key, document }) => {
      if (!artifacts.has(key)) artifacts.set(key, document);
      return artifacts.get(key);
    },
    reserveDispatch: async (input) => {
      const { key, document } = input;
      if (artifacts.has(key)) return false;
      if (input.collectionReviewAttempt) {
        const { key, collectionId, reviewKey } = input.collectionReviewAttempt;
        const prior = artifacts.get(key) as
          | { collectionId: string; reviewKey: string }
          | undefined;
        if (
          prior &&
          (prior.collectionId !== collectionId || prior.reviewKey !== reviewKey)
        )
          throw new Error(
            "Another collection review attempt already owns this revision",
          );
        artifacts.set(key, { collectionId, reviewKey });
      }
      artifacts.set(key, document);
      return true;
    },
    author: async (input) => {
      calls.push({ role: "author", correction: input.correction });
      return authorCaliforniaBrief(input, {
        now: deps.now,
        invoke: async () => ({
          output: {
            priorities: {
              claims: [
                {
                  kind: "promise",
                  text:
                    input.correction?.kind === "review_rejection"
                      ? "Morgan Lee proposes public-library funding."
                      : "Morgan Lee proposes funding public libraries.",
                  evidenceIds: ["platform"],
                  promiseDetails: null,
                },
              ],
            },
            record: { claims: [] },
            mechanisms: { claims: [] },
            effects: { claims: [] },
            tradeoffs: { claims: [] },
            unknowns: { claims: [] },
            terms: [],
          },
          configuredModel: "fixture",
          actualModel: "fixture",
          provider: "fixture",
          requestId: "request",
          usage: { inputTokens: 100, outputTokens: 50 },
          costUsd: null,
        }),
      });
    },
    review: async ({ authorAttestation }) => {
      calls.push({ role: "reviewer" });
      return {
        verdict: "approve",
        overallReason: "The exact brief is supported by its source context.",
        findings: [],
        attestation: {
          ...authorAttestation,
          role: "reviewer",
          actorId: "reviewer",
          runId: randomUUID(),
          usage: { inputTokens: 75, outputTokens: 25 },
        },
      };
    },
  };
  const fresh = (overrides: Partial<Input> = {}): Input => ({
    dossier,
    policyVersion: "policy",
    raceKey: "race",
    candidateId: dossier.identity.candidateId,
    lease: {
      key: "work",
      owner: randomUUID(),
      generation: 1,
      reviewEpoch: 0,
      checkpoint: null,
    },
    bounds: { maxModelCalls: 10, maxInputTokens: 1_000_000 },
    usage: {
      modelCalls: 0,
      inputTokenReservations: 0,
      actualInputTokens: 0,
      actualOutputTokens: 0,
    },
    provenance: {
      dossierDigest: dossier.dossierDigest,
      classification: dossier.classification,
      sourceCheckedAt: dossier.createdAt,
    },
    ...overrides,
  });
  return { deps, artifacts, calls, fresh };
}
function failInitial(f: ReturnType<typeof fixture>, value = diagnostic()) {
  const author = f.deps.author;
  f.deps.author = async (input) => {
    if (!input.correction) {
      f.calls.push({ role: "author" });
      throw new CaliforniaModelInvocationError(value);
    }
    return author(input);
  };
}
function slot(f: ReturnType<typeof fixture>) {
  const entry = [...f.artifacts.entries()].find(([key]) =>
    key.startsWith("correction-plan:"),
  );
  assert.ok(entry);
  return {
    key: entry[0],
    document: entry[1] as {
      authorKey: string;
      feedback: unknown;
      feedbackDigest: string;
    },
  };
}

test("one rejected correction exhausts the shared slot across reviewer wording, owner, generation and epoch changes", async () => {
  const f = fixture();
  const review = f.deps.review;
  let wording =
    "The priorities chapter attributes an unsupported implementation to the candidate.";
  f.deps.review = async (input) => ({
    ...(await review(input)),
    verdict: "reject",
    overallReason: wording,
  });
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(f.fresh(), f.deps),
    /bounded correction/,
  );
  assert.equal(f.calls.length, 4);
  const plan = slot(f);
  wording =
    "The new reviewer identifies another unsupported sentence in priorities.";
  const input = f.fresh();
  input.lease = {
    ...input.lease,
    owner: "replacement",
    generation: 7,
    reviewEpoch: 8,
  };
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(input, f.deps),
    /bounded candidate correction/,
  );
  assert.equal(f.calls.length, 4);
  assert.equal(input.usage.modelCalls, 0);
  assert.deepEqual(slot(f), plan);
  assert.equal(
    [...f.artifacts.keys()].filter((key) =>
      key.startsWith("author-correction:"),
    ).length,
    1,
  );
});

test("unchanged rejected content cannot obtain another review through new metadata or a cached approval", async () => {
  const f = fixture();
  const author = f.deps.author;
  let corrected: Awaited<ReturnType<Dependencies["author"]>> | undefined;
  f.deps.author = async (input) => {
    const result = await author(input);
    if (input.correction?.kind === "review_rejection") {
      const previous = input.correction.previousBrief;
      result.brief = {
        ...previous,
        revisionId: result.brief.revisionId,
        createdAt: "2026-10-30T00:00:02.000Z",
        authorId: result.brief.authorId,
        supersedes: previous.revisionId,
        correction: {
          reason: "Reassessed the same public content.",
          previousRevisionId: previous.revisionId,
        },
        evidence: previous.evidence.map((entry) => ({
          ...entry,
          retrievedAt: "2026-10-30T00:00:02.000Z",
        })),
      };
      result.attestation.revisionDigest = evidenceDigest(result.brief);
      corrected = result;
    }
    return result;
  };
  const review = f.deps.review;
  f.deps.review = async (input) => ({
    ...(await review(input)),
    verdict: "reject",
    overallReason: "The Record disclosure contains internal workflow text.",
  });
  const artifact = f.deps.artifact;
  let correctedReviewReads = 0;
  f.deps.artifact = async (key) => {
    if (key.startsWith("review:") && corrected) {
      correctedReviewReads++;
      return {
        verdict: "approve",
        overallReason: "A cached approval for unchanged content.",
        findings: [],
        attestation: {
          ...corrected.attestation,
          role: "reviewer",
          actorId: "cached-reviewer",
          runId: randomUUID(),
        },
      };
    }
    return artifact(key);
  };
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(f.fresh(), f.deps),
    /did not change the rejected public content/,
  );
  assert.equal(f.calls.filter((call) => call.role === "author").length, 2);
  assert.equal(f.calls.filter((call) => call.role === "reviewer").length, 1);
  assert.equal(correctedReviewReads, 0);
  const calls = f.calls.length;
  const input = f.fresh();
  input.lease.owner = "replacement";
  input.lease.generation++;
  input.lease.reviewEpoch++;
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(input, f.deps),
    /did not change the rejected public content/,
  );
  assert.equal(f.calls.length, calls);
  assert.equal(input.usage.modelCalls, 0);
  assert.equal(correctedReviewReads, 0);
});

test("a changed correction can remove an unsupported assertion and obtain fresh review", async () => {
  const f = fixture();
  const author = f.deps.author;
  f.deps.author = async (input) => {
    const result = await author(input);
    if (!input.correction) {
      result.brief.sections[0]!.claims[0]!.text +=
        " The candidate can do so without legislative approval.";
      result.attestation.revisionDigest = evidenceDigest(result.brief);
    }
    return result;
  };
  const review = f.deps.review;
  f.deps.review = async (input) => {
    const result = await review(input);
    if (
      input.brief.sections[0]!.claims[0]!.text.includes(
        "without legislative approval",
      )
    )
      return {
        ...result,
        verdict: "reject",
        overallReason:
          "The cited proposal does not establish unilateral spending authority.",
      };
    return result;
  };
  const prepared = await prepareReviewedCaliforniaCandidate(f.fresh(), f.deps);
  assert.equal(prepared.reviewed.verdict, "approve");
  assert.ok(
    !prepared.authored.brief.sections[0]!.claims[0]!.text.includes(
      "without legislative approval",
    ),
  );
  assert.equal(f.calls.filter((call) => call.role === "author").length, 2);
  assert.equal(f.calls.filter((call) => call.role === "reviewer").length, 2);
  const calls = f.calls.length;
  await prepareReviewedCaliforniaCandidate(f.fresh(), f.deps);
  assert.equal(f.calls.length, calls);
});

test("a terminal schema failure on the correction cannot consume a second schema or review correction", async () => {
  const f = fixture();
  f.deps.author = async () => {
    f.calls.push({ role: "author" });
    throw new CaliforniaModelInvocationError(diagnostic());
  };
  const first = f.fresh();
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(first, f.deps),
    /schema_validation/,
  );
  assert.equal(first.usage.modelCalls, 2);
  assert.equal(first.usage.actualInputTokens, 246);
  assert.equal(first.usage.actualOutputTokens, 90);
  for (const epoch of [0, 1, 5]) {
    const input = f.fresh();
    input.lease.reviewEpoch = epoch;
    input.lease.generation = epoch + 2;
    await assert.rejects(
      prepareReviewedCaliforniaCandidate(input, f.deps),
      /bounded correction is exhausted/,
    );
    assert.equal(input.usage.modelCalls, 0);
    assert.equal(input.usage.actualInputTokens, 0);
  }
  assert.equal(f.calls.length, 2);
  assert.equal(
    [...f.artifacts.keys()].filter((key) => key.startsWith("correction-plan:"))
      .length,
    1,
  );
});

for (const point of [
  "before_plan",
  "after_plan",
  "after_dispatch",
  "after_terminal",
] as const) {
  test(`restart at ${point} reuses the immutable correction slot and never replays an uncertain dispatch`, async () => {
    const f = fixture();
    failInitial(f);
    const save = f.deps.saveArtifact,
      reserve = f.deps.reserveDispatch;
    let interrupted = false;
    f.deps.saveArtifact = async (input) => {
      if (
        !interrupted &&
        input.kind === "model_correction" &&
        point === "before_plan"
      ) {
        interrupted = true;
        throw Error("interrupted before plan");
      }
      const result = await save(input);
      if (
        !interrupted &&
        ((input.kind === "model_correction" && point === "after_plan") ||
          (input.key.startsWith("author-correction:") &&
            point === "after_terminal"))
      ) {
        interrupted = true;
        throw Error(`interrupted ${point}`);
      }
      return result;
    };
    f.deps.reserveDispatch = async (input) => {
      const result = await reserve(input);
      if (
        !interrupted &&
        input.key.startsWith("dispatch:author-correction:") &&
        point === "after_dispatch"
      ) {
        interrupted = true;
        throw Error("interrupted after dispatch");
      }
      return result;
    };
    await assert.rejects(
      prepareReviewedCaliforniaCandidate(f.fresh(), f.deps),
      /interrupted/,
    );
    const resumed = f.fresh();
    resumed.lease = {
      ...resumed.lease,
      owner: "next-owner",
      generation: 2,
      reviewEpoch: 3,
    };
    if (point === "after_dispatch") {
      await assert.rejects(
        prepareReviewedCaliforniaCandidate(resumed, f.deps),
        /already reserved/,
      );
      assert.equal(f.calls.length, 1);
      assert.equal(resumed.usage.modelCalls, 0);
    } else {
      const prepared = await prepareReviewedCaliforniaCandidate(
        resumed,
        f.deps,
      );
      assert.equal(prepared.reviewed.verdict, "approve");
      assert.equal(f.calls.length, 3);
      assert.equal(
        resumed.usage.modelCalls,
        point === "after_terminal" ? 1 : 2,
      );
    }
    assert.equal(
      [...f.artifacts.keys()].filter((key) =>
        key.startsWith("correction-plan:"),
      ).length,
      1,
    );
  });
}

test("insert conflict winner supplies the only child and feedback, including after JSONB key reordering", async () => {
  const winner = fixture();
  failInitial(
    winner,
    diagnostic({
      parsedOutput: { persisted: "winner", nested: { a: 1, b: 2 } },
    }),
  );
  const stopped = winner.fresh({
    bounds: { maxModelCalls: 1, maxInputTokens: 1_000_000 },
  });
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(stopped, winner.deps),
    /budget/i,
  );
  const winning = slot(winner);
  const reorder = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(reorder)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .reverse()
              .map(([key, item]) => [key, reorder(item)]),
          )
        : value;
  const f = fixture();
  failInitial(f, diagnostic({ parsedOutput: { losing: "local proposal" } }));
  const save = f.deps.saveArtifact;
  f.deps.saveArtifact = async (input) =>
    input.kind === "model_correction"
      ? (f.artifacts.set(input.key, reorder(winning.document)),
        f.artifacts.get(input.key))
      : save(input);
  const prepared = await prepareReviewedCaliforniaCandidate(f.fresh(), f.deps);
  assert.equal(prepared.reviewed.verdict, "approve");
  assert.deepEqual(
    f.calls.find((call) => call.correction)?.correction,
    winning.document.feedback,
  );
  assert.ok(f.artifacts.has(`dispatch:${winning.document.authorKey}`));
  assert.equal(
    [...f.artifacts.keys()].filter((key) =>
      key.startsWith("dispatch:author-correction:"),
    ).length,
    1,
  );
});

test("the full correction prompt is budgeted before any dispatch reservation", async () => {
  const f = fixture();
  failInitial(
    f,
    diagnostic({ parsedOutput: { output: "long response ".repeat(3000) } }),
  );
  const first = f.fresh({
    bounds: { maxModelCalls: 1, maxInputTokens: 1_000_000 },
  });
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(first, f.deps),
    /budget/i,
  );
  const before = [...f.artifacts.keys()];
  const base = californiaModelInput({
    dossier: first.dossier,
    policyVersion: first.policyVersion,
  }).inputTokenReservation;
  const input = f.fresh({
    bounds: { maxModelCalls: 10, maxInputTokens: base },
  });
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(input, f.deps),
    /budget/i,
  );
  assert.equal(input.usage.modelCalls, 0);
  assert.equal(input.usage.inputTokenReservations, 0);
  assert.equal(f.calls.length, 1);
  assert.deepEqual([...f.artifacts.keys()], before);
});

for (const invalid of [
  { errorKind: "output_limit" },
  { errorKind: "timeout" },
  { errorKind: "json_parse" },
  { errorKind: "provider_error" },
  { actualModel: null },
  { finishReason: null, parsedOutput: null },
  { finishReason: null, requestId: null },
  { finishReason: null, usage: { ...diagnostic().usage, inputTokens: null } },
  { validationProblems: [] },
  { parsedOutput: null, rawText: "not JSON" },
] satisfies Partial<CaliforniaModelFailureDiagnostic>[]) {
  test(`untrusted terminal diagnostic ${JSON.stringify(invalid)} never authorizes correction`, async () => {
    const f = fixture();
    failInitial(f, diagnostic(invalid));
    for (let run = 0; run < 2; run++)
      await assert.rejects(
        prepareReviewedCaliforniaCandidate(f.fresh(), f.deps),
      );
    assert.equal(f.calls.length, 1);
    assert.equal(
      [...f.artifacts.keys()].some((key) => key.startsWith("correction-plan:")),
      false,
    );
  });
}

test("a stale lease cannot reserve an initial or correction call", async () => {
  for (const correction of [false, true]) {
    const f = fixture();
    if (correction) {
      failInitial(f);
      await assert.rejects(
        prepareReviewedCaliforniaCandidate(
          f.fresh({ bounds: { maxModelCalls: 1, maxInputTokens: 1_000_000 } }),
          f.deps,
        ),
        /budget/i,
      );
    }
    const before = f.calls.length;
    f.deps.reserveDispatch = async () => false;
    const input = f.fresh();
    await assert.rejects(
      prepareReviewedCaliforniaCandidate(input, f.deps),
      /lease expired/,
    );
    assert.equal(f.calls.length, before);
    assert.equal(input.usage.modelCalls, 0);
  }
});

test("a corrupted persisted plan fails closed before invoking any model", async () => {
  const f = fixture();
  failInitial(f);
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(
      f.fresh({ bounds: { maxModelCalls: 1, maxInputTokens: 1_000_000 } }),
      f.deps,
    ),
    /budget/i,
  );
  const plan = slot(f);
  f.artifacts.set(plan.key, { ...plan.document, feedbackDigest: "changed" });
  const input = f.fresh();
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(input, f.deps),
    /immutable author contract/,
  );
  assert.equal(input.usage.modelCalls, 0);
  assert.equal(f.calls.length, 1);
});

test("oversized correction feedback stays pending without a child dispatch", async () => {
  const f = fixture();
  failInitial(
    f,
    diagnostic({
      parsedOutput: { response: "large prior output ".repeat(12000) },
    }),
  );
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(f.fresh(), f.deps),
    (error: unknown) =>
      error instanceof PendingCandidateResearchGap &&
      /bounded correction prompt/.test(error.message),
  );
  assert.equal(f.calls.length, 1);
  assert.equal(
    [...f.artifacts.keys()].some((key) =>
      key.startsWith("dispatch:author-correction:"),
    ),
    false,
  );
});

test("a schema correction rejected by review remains exhausted after its terminal rejection write is interrupted", async () => {
  const f = fixture();
  failInitial(f);
  const review = f.deps.review,
    save = f.deps.saveArtifact;
  f.deps.review = async (input) => ({
    ...(await review(input)),
    verdict: "reject",
    overallReason:
      "The replacement still attributes an unsupported promise to the campaign.",
  });
  let interrupted = false;
  f.deps.saveArtifact = async (input) => {
    const saved = await save(input);
    if (!interrupted && input.kind === "model_correction_rejection") {
      interrupted = true;
      throw Error("interrupted after terminal rejection");
    }
    return saved;
  };
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(f.fresh(), f.deps),
    /interrupted/,
  );
  const input = f.fresh();
  input.lease.reviewEpoch = 9;
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(input, f.deps),
    /bounded candidate correction/,
  );
  assert.equal(f.calls.length, 3);
  assert.equal(input.usage.modelCalls, 0);
  assert.equal(slot(f).document.feedback instanceof Object, true);
  assert.ok(
    input.provenance.modelArtifactKeys?.some((key) =>
      key.startsWith("failure:author:"),
    ),
  );
  assert.ok(
    input.provenance.modelArtifactKeys?.some((key) =>
      key.startsWith("correction-rejected:"),
    ),
  );
});

test("a concrete rejected claim finding authorizes the one correction when whole-brief feedback is absent", async () => {
  const f = fixture();
  const review = f.deps.review;
  let rejected = false;
  f.deps.review = async (input) => {
    const result = await review(input);
    if (!rejected) {
      rejected = true;
      return {
        ...result,
        verdict: "reject",
        overallReason: undefined,
        findings: [
          {
            claimId: "priorities-1",
            supported: false,
            reason:
              "The source supports library funding but not the claimed budget amount.",
          },
        ],
      };
    }
    return result;
  };
  const prepared = await prepareReviewedCaliforniaCandidate(f.fresh(), f.deps);
  assert.equal(prepared.reviewed.verdict, "approve");
  assert.equal(f.calls.length, 4);
  assert.deepEqual(
    (
      f.calls.find((call) => call.correction)?.correction as {
        overallReason: unknown;
      }
    ).overallReason,
    null,
  );
});

test("the saved Wagner output returned without finish metadata remains a known compiler failure eligible for one correction", async () => {
  const saved = JSON.parse(
    await readFile(
      new URL("./fixtures/wagner-author-origin-failure.json", import.meta.url),
      "utf8",
    ),
  ) as {
    dossier: CandidateEvidenceDossier;
    output: { record: { claims: { kind: string }[] } };
    provenance: {
      configuredModel: string;
      actualModel: string;
      provider: string;
      requestId: string;
      usage: { inputTokens: number; outputTokens: number };
    };
  };
  const f = fixture();
  let initialDiagnostic: CaliforniaModelFailureDiagnostic | undefined;
  f.deps.author = async (input) => {
    f.calls.push({ role: "author", correction: input.correction });
    const output = structuredClone(saved.output);
    if (input.correction) {
      assert.equal(input.correction.kind, "author_validation");
      assert.deepEqual(
        (input.correction as { previousOutput: unknown }).previousOutput,
        saved.output,
      );
      assert.equal(initialDiagnostic?.finishReason, null);
      output.record.claims[0]!.kind = "analysis";
    }
    try {
      return await authorCaliforniaBrief(input, {
        now: f.deps.now,
        invoke: async () => ({ ...saved.provenance, output, costUsd: null }),
      });
    } catch (error) {
      assert.ok(error instanceof CaliforniaModelInvocationError);
      initialDiagnostic = error.diagnostic;
      assert.equal(initialDiagnostic.errorKind, "schema_validation");
      assert.deepEqual(initialDiagnostic.parsedOutput, saved.output);
      throw error;
    }
  };
  const input = f.fresh({
    dossier: saved.dossier,
    candidateId: saved.dossier.identity.candidateId,
  });
  const prepared = await prepareReviewedCaliforniaCandidate(input, f.deps);
  assert.equal(prepared.reviewed.verdict, "approve");
  assert.equal(f.calls.length, 3);
  assert.equal(
    input.usage.actualInputTokens,
    saved.provenance.usage.inputTokens * 2 + 75,
  );
});

test("a corrected author awaiting review never inherits the rejected parent revision's reviewer", async () => {
  const f = fixture();
  const review = f.deps.review;
  f.deps.review = async (input) => ({
    ...(await review(input)),
    verdict: "reject",
    overallReason:
      "The priorities claim attributes an unsupported budget amount to the candidate.",
  });
  const input = f.fresh({
    bounds: { maxModelCalls: 3, maxInputTokens: 1_000_000 },
  });
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(input, f.deps),
    /budget/i,
  );
  assert.ok(input.provenance.author);
  assert.equal(input.provenance.reviewer, undefined);
  assert.equal(input.provenance.verdict, undefined);
  assert.equal(input.usage.modelCalls, 3);
});

function campaignSubjectDossier() {
  const {
    schemaVersion: _schema,
    classification: _classification,
    sourceSetDigest: _sources,
    dossierDigest: _digest,
    ...input
  } = fixtureDossier();
  input.evidence[1] = {
    ...input.evidence[1]!,
    role: "campaign_material",
    attribution: {
      status: "unresolved",
      context: {
        excerpt: input.sources[0]!.text,
        locator: "Campaign account of Morgan Lee's proposals",
      },
    },
  };
  return buildCaliforniaDossier(input);
}

function emptyAuthor(f: ReturnType<typeof fixture>) {
  return async (input: Parameters<Dependencies["author"]>[0]) => {
    f.calls.push({ role: "author", correction: input.correction });
    return authorCaliforniaBrief(input, {
      now: f.deps.now,
      invoke: async () => ({
        output: {
          priorities: { claims: [] },
          record: { claims: [] },
          mechanisms: { claims: [] },
          effects: { claims: [] },
          tradeoffs: { claims: [] },
          unknowns: { claims: [] },
          terms: [],
        },
        configuredModel: "fixture",
        actualModel: "fixture",
        provider: "fixture",
        requestId: "empty-completed-response",
        usage: { inputTokens: 100, outputTokens: 50 },
        costUsd: null,
      }),
    });
  };
}

function financedDossier(dossier = campaignSubjectDossier()) {
  const {
    schemaVersion: _schema,
    classification: _classification,
    sourceSetDigest: _sources,
    dossierDigest: _digest,
    ...input
  } = dossier;
  input.officeKind = "federal_legislative";
  input.officeFamily = "us_house";
  input.identity = {
    ...input.identity,
    candidateId: "ca-sos:2026-11-03:110000010000:1",
    contestId: "ca-sos:2026-11-03:110000010000",
    jurisdiction: "ocd-division/country:us/state:ca/cd:1",
  };
  for (const source of input.sources) {
    source.text = source.text.replaceAll(
      "Assembly District 1",
      "House District 1",
    );
    source.contentHash = createHash("sha256").update(source.text).digest("hex");
  }
  for (const entry of input.evidence) {
    entry.excerpt = entry.excerpt.replaceAll(
      "Assembly District 1",
      "House District 1",
    );
    if (entry.attribution)
      entry.attribution.context.excerpt =
        entry.attribution.context.excerpt.replaceAll(
          "Assembly District 1",
          "House District 1",
        );
  }
  const text = "H0CA01001|LEE, MORGAN|DEM|2026|CA|H|01|C|C|C00000001|||||\n";
  const contentHash = createHash("sha256").update(text).digest("hex");
  const filingText = "Total receipts $100.00";
  input.sources.push(
    {
      id: "fec-master",
      url: "https://www.fec.gov/files/bulk-downloads/2026/cn26.zip",
      publisher: "FEC fixture",
      format: "text",
      text,
      contentHash,
      fetchedAt: input.createdAt,
    },
    {
      id: "filing",
      url: "https://www.fec.gov/data/candidate/H0CA01001/?cycle=2026",
      publisher: "FEC fixture",
      format: "html",
      text: filingText,
      contentHash: createHash("sha256").update(filingText).digest("hex"),
      fetchedAt: input.createdAt,
    },
  );
  input.evidence.push({
    id: "finance",
    sourceId: "filing",
    excerpt: filingText,
    locator: "Processed financial summary",
    origin: "primary_record",
    role: "finance",
    identityQualification: "exact_election_office",
  });
  input.financeIdentityProof = {
    candidateId: "H0CA01001",
    name: "LEE, MORGAN",
    office: "H",
    state: "CA",
    district: "1",
    cycle: 2026,
    sourceId: "fec-master",
    sourceHash: contentHash,
  };
  input.finance = {
    committeeId: "C00000001",
    committeeName: "Fixture committee",
    periodStart: "2025-01-01",
    periodEnd: "2026-09-30",
    currency: "USD",
    coverage: "partial",
    coverageNote: "Fixture processed summary",
    updatedAt: input.createdAt,
    filingEvidenceIds: ["finance"],
    receipts: {
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
    },
    donors: [],
    donorAmounts: "contribution",
    donorCoverage: "unavailable",
    outsideSpending: null,
  };
  return buildCaliforniaDossier(input);
}

test("valid finance does not skip one reassessment of supplied campaign research", async () => {
  const f = fixture();
  const dossier = financedDossier();
  const author = f.deps.author;
  const empty = emptyAuthor(f);
  f.deps.author = async (input) => {
    if (!input.correction) {
      const original = await empty(input);
      assert.equal(
        hasSubstantiveCandidateResearch(original.brief, dossier),
        true,
      );
      return original;
    }
    assert.equal(input.correction.kind, "author_validation");
    if (input.correction.kind === "author_validation") {
      assert.match(
        input.correction.validationProblems.join(" "),
        /finance-only/,
      );
      assert.match(
        input.correction.validationProblems.join(" "),
        /unresolved/i,
      );
    }
    return author(input);
  };
  const prepared = await prepareReviewedCaliforniaCandidate(
    f.fresh({ dossier, candidateId: dossier.identity.candidateId }),
    f.deps,
  );
  assert.equal(prepared.authored.brief.sections[0]!.claims.length, 1);
  assert.deepEqual(prepared.authored.brief.research!.finance, dossier.finance);
  assert.deepEqual(
    f.calls.map((call) => call.role),
    ["author", "author", "reviewer"],
  );
  const plan = slot(f);
  const resumed = f.fresh({
    dossier,
    candidateId: dossier.identity.candidateId,
  });
  resumed.lease = { ...resumed.lease, owner: "replacement", generation: 4 };
  await prepareReviewedCaliforniaCandidate(resumed, f.deps);
  assert.equal(resumed.usage.modelCalls, 0);
  assert.deepEqual(slot(f), plan);
});

test("honest campaign abstention preserves valid finance and still requires independent review", async () => {
  const f = fixture();
  const dossier = financedDossier(fixtureCampaignMaterialDossier());
  f.deps.author = emptyAuthor(f);
  const prepared = await prepareReviewedCaliforniaCandidate(
    f.fresh({ dossier, candidateId: dossier.identity.candidateId }),
    f.deps,
  );
  assert.equal(
    prepared.authored.brief.sections.flatMap((s) => s.claims).length,
    0,
  );
  assert.deepEqual(prepared.authored.brief.research!.finance, dossier.finance);
  assert.equal(prepared.reviewed.verdict, "approve");
  assert.deepEqual(
    f.calls.map((call) => call.role),
    ["author", "author", "reviewer"],
  );
  assert.equal(
    [...f.artifacts.keys()].filter((key) => key.startsWith("correction-plan:"))
      .length,
    1,
  );
});

test("finance without candidate passages proceeds without a prose correction", async () => {
  const f = fixture();
  const dossier = financedDossier(fixtureDossier(false));
  f.deps.author = emptyAuthor(f);
  const prepared = await prepareReviewedCaliforniaCandidate(
    f.fresh({ dossier, candidateId: dossier.identity.candidateId }),
    f.deps,
  );
  assert.equal(prepared.reviewed.verdict, "approve");
  assert.deepEqual(
    f.calls.map((call) => call.role),
    ["author", "reviewer"],
  );
  assert.equal(
    [...f.artifacts.keys()].some((key) => key.startsWith("correction-plan:")),
    false,
  );
});

test("initial candidate prose and valid finance proceed without another author call", async () => {
  const f = fixture();
  const dossier = financedDossier();
  const prepared = await prepareReviewedCaliforniaCandidate(
    f.fresh({ dossier, candidateId: dossier.identity.candidateId }),
    f.deps,
  );
  assert.equal(prepared.authored.brief.sections[0]!.claims.length, 1);
  assert.equal(prepared.reviewed.verdict, "approve");
  assert.deepEqual(
    f.calls.map((call) => call.role),
    ["author", "reviewer"],
  );
  assert.equal(
    [...f.artifacts.keys()].some((key) => key.startsWith("correction-plan:")),
    false,
  );
});

test("a financed prose reassessment reserves its budget and resumes the same correction", async () => {
  const f = fixture();
  const dossier = financedDossier();
  const author = f.deps.author;
  const empty = emptyAuthor(f);
  f.deps.author = (input) => (input.correction ? author(input) : empty(input));
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(
      f.fresh({
        dossier,
        candidateId: dossier.identity.candidateId,
        bounds: { maxModelCalls: 1, maxInputTokens: 1_000_000 },
      }),
      f.deps,
    ),
    /budget/i,
  );
  assert.equal(f.calls.length, 1);
  const plan = slot(f);
  const resumed = f.fresh({
    dossier,
    candidateId: dossier.identity.candidateId,
  });
  await prepareReviewedCaliforniaCandidate(resumed, f.deps);
  assert.equal(resumed.usage.modelCalls, 2);
  assert.deepEqual(slot(f), plan);
});

test("a successful empty author on supported campaign material uses one substantive correction before independent review", async () => {
  const f = fixture();
  const dossier = campaignSubjectDossier();
  assert.equal(dossier.classification, "supported");
  const author = f.deps.author;
  const empty = emptyAuthor(f);
  let previousBrief: unknown;
  f.deps.author = async (input) => {
    if (!input.correction) {
      const result = await empty(input);
      previousBrief = result.brief;
      return result;
    }
    assert.equal(input.correction.kind, "author_validation");
    if (input.correction.kind === "author_validation") {
      assert.deepEqual(input.correction.previousOutput, previousBrief);
      assert.match(
        input.correction.validationProblems.join(" "),
        /substantive/i,
      );
      assert.match(input.correction.validationProblems.join(" "), /platform/);
      assert.match(
        input.correction.validationProblems.join(" "),
        /unresolved/i,
      );
    }
    return author(input);
  };
  const input = f.fresh({ dossier });
  const prepared = await prepareReviewedCaliforniaCandidate(input, f.deps);
  assert.equal(prepared.reviewed.verdict, "approve");
  assert.equal(
    prepared.authored.brief.sections.find(
      (section) => section.topic === "priorities",
    )!.claims.length,
    1,
  );
  assert.deepEqual(
    f.calls.map((call) => call.role),
    ["author", "author", "reviewer"],
  );
  assert.equal(input.usage.modelCalls, 3);
  assert.equal(input.usage.actualInputTokens, 275);
  assert.equal(input.usage.actualOutputTokens, 125);
  assert.equal(
    [...f.artifacts.keys()].filter((key) => key.startsWith("correction-plan:"))
      .length,
    1,
  );
  const plan = slot(f);
  const resumed = f.fresh({ dossier });
  resumed.lease = { ...resumed.lease, owner: "replacement", generation: 3 };
  await prepareReviewedCaliforniaCandidate(resumed, f.deps);
  assert.equal(resumed.usage.modelCalls, 0);
  assert.deepEqual(slot(f), plan);
});

test("an unresolved third-party pledge can stay empty after its single correction and remains unpublished across restarts", async () => {
  const f = fixture();
  const dossier = fixtureCampaignMaterialDossier();
  assert.equal(dossier.classification, "supported");
  f.deps.author = emptyAuthor(f);
  for (const epoch of [0, 3, 9]) {
    const input = f.fresh({ dossier });
    input.lease = {
      ...input.lease,
      owner: `owner-${epoch}`,
      generation: epoch + 1,
      reviewEpoch: epoch,
    };
    await assert.rejects(
      prepareReviewedCaliforniaCandidate(input, f.deps),
      (error: unknown) => error instanceof PendingCandidateResearchGap,
    );
    assert.equal(input.provenance.reviewer, undefined);
    assert.equal(input.provenance.verdict, undefined);
    assert.equal(input.usage.modelCalls, epoch === 0 ? 2 : 0);
  }
  assert.deepEqual(
    f.calls.map((call) => call.role),
    ["author", "author"],
  );
  assert.equal(
    [...f.artifacts.keys()].filter((key) => key.startsWith("correction-plan:"))
      .length,
    1,
  );
});

test("a roster-only evidence gap does not dispatch a substantive correction", async () => {
  const f = fixture();
  const dossier = fixtureDossier(false);
  f.deps.author = emptyAuthor(f);
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(f.fresh({ dossier }), f.deps),
    (error: unknown) => error instanceof PendingCandidateResearchGap,
  );
  assert.equal(f.calls.length, 1);
  assert.equal(
    [...f.artifacts.keys()].some((key) => key.startsWith("correction-plan:")),
    false,
  );
});

test("a substantive correction respects its reservation budget and resumes the same saved author trigger", async () => {
  const f = fixture();
  const dossier = campaignSubjectDossier();
  const author = f.deps.author;
  const empty = emptyAuthor(f);
  f.deps.author = (input) => (input.correction ? author(input) : empty(input));
  const initial = f.fresh({
    dossier,
    bounds: { maxModelCalls: 1, maxInputTokens: 1_000_000 },
  });
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(initial, f.deps),
    /budget/i,
  );
  assert.equal(initial.usage.modelCalls, 1);
  assert.equal(
    [...f.artifacts.keys()].some((key) =>
      key.startsWith("dispatch:author-correction:"),
    ),
    false,
  );
  assert.equal(
    [...f.artifacts.keys()].some((key) => key.startsWith("failure:")),
    false,
  );
  const plan = slot(f);
  const resumed = f.fresh({ dossier });
  const prepared = await prepareReviewedCaliforniaCandidate(resumed, f.deps);
  assert.equal(prepared.reviewed.verdict, "approve");
  assert.equal(resumed.usage.modelCalls, 2);
  assert.deepEqual(slot(f), plan);
});

test("an uncertain substantive correction dispatch never replays after owner or review epoch changes", async () => {
  const f = fixture();
  const dossier = campaignSubjectDossier();
  f.deps.author = emptyAuthor(f);
  const reserve = f.deps.reserveDispatch;
  let interrupted = false;
  f.deps.reserveDispatch = async (input) => {
    const result = await reserve(input);
    if (!interrupted && input.key.startsWith("dispatch:author-correction:")) {
      interrupted = true;
      throw Error("interrupted after substantive correction reservation");
    }
    return result;
  };
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(f.fresh({ dossier }), f.deps),
    /interrupted/,
  );
  const plan = slot(f);
  const resumed = f.fresh({ dossier });
  resumed.lease = {
    ...resumed.lease,
    owner: "replacement",
    generation: 5,
    reviewEpoch: 9,
  };
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(resumed, f.deps),
    /already reserved/,
  );
  assert.equal(f.calls.length, 1);
  assert.equal(resumed.usage.modelCalls, 0);
  assert.deepEqual(slot(f), plan);
});

test("collection-bound review uses one fresh invocation and survives lease reclaim", async () => {
  const f = fixture();
  const prepared = await prepareReviewedCaliforniaCandidate(f.fresh(), f.deps);
  const collectionId = randomUUID();
  const input = { ...f.fresh(), collectionId, prepared };
  const before = f.calls.length;
  const reviewed = await reviewPreparedCaliforniaCandidateForCollection(
    input,
    f.deps,
  );
  assert.equal(f.calls.length, before + 1);
  assert.notEqual(
    reviewed.attestation.runId,
    prepared.reviewed.attestation.runId,
  );
  const resumed = await reviewPreparedCaliforniaCandidateForCollection(
    {
      ...input,
      lease: { ...input.lease, owner: randomUUID(), generation: 25 },
    },
    f.deps,
  );
  assert.deepEqual(resumed, reviewed);
  assert.equal(f.calls.length, before + 1);
  const next = await reviewPreparedCaliforniaCandidateForCollection(
    { ...input, collectionId: randomUUID() },
    f.deps,
  );
  assert.notEqual(next.attestation.runId, reviewed.attestation.runId);
  assert.equal(f.calls.length, before + 2);
});

test("a refused collection reservation leaves no attempt and allows its replacement to continue", async () => {
  const f = fixture();
  const prepared = await prepareReviewedCaliforniaCandidate(f.fresh(), f.deps);
  const collectionId = randomUUID();
  const reserve = f.deps.reserveDispatch;
  const before = f.calls.length;
  const artifactKeys = [...f.artifacts.keys()];
  f.deps.reserveDispatch = async () => false;
  await assert.rejects(
    reviewPreparedCaliforniaCandidateForCollection(
      { ...f.fresh(), collectionId, prepared },
      f.deps,
    ),
    /lease expired/,
  );
  assert.equal(f.calls.length, before);
  assert.deepEqual([...f.artifacts.keys()], artifactKeys);
  f.deps.reserveDispatch = reserve;
  const input = f.fresh();
  input.lease.generation++;
  const resumed = await prepareReviewedCaliforniaCandidate(input, f.deps);
  assert.equal(f.calls.length, before);
  const reviewed = await reviewPreparedCaliforniaCandidateForCollection(
    { ...input, collectionId, prepared: resumed },
    f.deps,
  );
  assert.equal(reviewed.verdict, "approve");
  assert.equal(f.calls.length, before + 1);
});

test("unknown collection reviewer dispatch cannot be replayed after lease reclaim", async () => {
  const f = fixture();
  const prepared = await prepareReviewedCaliforniaCandidate(f.fresh(), f.deps);
  let reviews = 0;
  f.deps.review = async () => {
    reviews++;
    throw new Error("lost response");
  };
  const input = { ...f.fresh(), collectionId: randomUUID(), prepared };
  await assert.rejects(
    reviewPreparedCaliforniaCandidateForCollection(input, f.deps),
    /lost response/,
  );
  await assert.rejects(
    reviewPreparedCaliforniaCandidateForCollection(
      {
        ...input,
        lease: { ...input.lease, owner: randomUUID(), generation: 99 },
      },
      f.deps,
    ),
    /unfinished or rejected collection review/,
  );
  await assert.rejects(
    reviewPreparedCaliforniaCandidateForCollection(
      { ...input, collectionId: randomUUID() },
      f.deps,
    ),
    /unfinished or rejected collection review/,
  );
  assert.equal(reviews, 1);
});

test("ordinary preparation cannot bypass an unknown collection review with cached approval, epoch or configuration changes", async () => {
  for (const change of ["cached", "epoch", "configuration"] as const) {
    const f = fixture();
    const prepared = await prepareReviewedCaliforniaCandidate(
      f.fresh(),
      f.deps,
    );
    const review = f.deps.review;
    f.deps.review = async () => {
      throw new Error("lost response");
    };
    await assert.rejects(
      reviewPreparedCaliforniaCandidateForCollection(
        { ...f.fresh(), collectionId: randomUUID(), prepared },
        f.deps,
      ),
      /lost response/,
    );
    f.deps.review = review;
    const calls = f.calls.length;
    const input = f.fresh();
    if (change === "epoch") input.lease.reviewEpoch++;
    if (change === "configuration")
      f.deps.reviewerConfigurationKey = "new-configuration";
    await assert.rejects(
      prepareReviewedCaliforniaCandidate(input, f.deps),
      /unfinished or rejected collection review/,
    );
    assert.equal(f.calls.length, calls, change);
    assert.equal(input.usage.modelCalls, 0, change);
  }
});

test("collection rejection is durable across target changes and uses the existing correction slot", async () => {
  const f = fixture();
  const prepared = await prepareReviewedCaliforniaCandidate(f.fresh(), f.deps);
  const review = f.deps.review;
  f.deps.review = async (input) => ({
    ...(await review(input)),
    verdict: "reject",
    overallReason: "The claimed plan lacks a supported implementation.",
    findings: [
      {
        claimId: "priorities-1",
        supported: false,
        reason: "Unsupported implementation",
      },
    ],
  });
  const input = { ...f.fresh(), collectionId: randomUUID(), prepared };
  await assert.rejects(
    reviewPreparedCaliforniaCandidateForCollection(input, f.deps),
    /Collection-bound independent review rejected/,
  );
  const calls = f.calls.length;
  await assert.rejects(
    reviewPreparedCaliforniaCandidateForCollection(
      { ...input, collectionId: randomUUID() },
      f.deps,
    ),
    /already rejected/,
  );
  assert.equal(f.calls.length, calls);
  f.deps.review = review;
  await prepareReviewedCaliforniaCandidate(f.fresh(), f.deps);
  assert.equal(f.calls.filter((call) => call.correction).length, 1);
  assert.ok(slot(f));
});

test("collection rejection fences target changes even when saving the review result is interrupted", async () => {
  const f = fixture();
  const prepared = await prepareReviewedCaliforniaCandidate(f.fresh(), f.deps);
  const review = f.deps.review;
  f.deps.review = async (input) => ({
    ...(await review(input)),
    verdict: "reject",
  });
  const save = f.deps.saveArtifact;
  f.deps.saveArtifact = async (input) => {
    if (input.kind === "review")
      throw new Error("review result write interrupted");
    return save(input);
  };
  const input = { ...f.fresh(), collectionId: randomUUID(), prepared };
  await assert.rejects(
    reviewPreparedCaliforniaCandidateForCollection(input, f.deps),
    /write interrupted/,
  );
  const calls = f.calls.length;
  await assert.rejects(
    reviewPreparedCaliforniaCandidateForCollection(
      { ...input, collectionId: randomUUID() },
      f.deps,
    ),
    /already rejected/,
  );
  assert.equal(f.calls.length, calls);
});

test("a rejected corrected revision cannot be reviewed again by changing epoch or configuration", async () => {
  const f = fixture();
  const review = f.deps.review;
  let count = 0;
  f.deps.review = async (input) => ({
    ...(await review(input)),
    verdict: ++count === 1 ? "reject" : "approve",
    overallReason: "The claimed plan lacks a supported implementation.",
    findings: [],
  });
  const prepared = await prepareReviewedCaliforniaCandidate(f.fresh(), f.deps);
  const plan = slot(f);
  f.deps.review = async (input) => ({
    ...(await review(input)),
    verdict: "reject",
  });
  await assert.rejects(
    reviewPreparedCaliforniaCandidateForCollection(
      { ...f.fresh(), collectionId: randomUUID(), prepared },
      f.deps,
    ),
    /review rejected/,
  );
  const calls = f.calls.length;
  f.deps.review = review;
  f.deps.reviewerConfigurationKey = "changed-configuration";
  const input = f.fresh();
  input.lease.reviewEpoch++;
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(input, f.deps),
    /bounded correction is exhausted/,
  );
  assert.equal(f.calls.length, calls);
  assert.deepEqual(slot(f), plan);
});

test("collection reviewer budget prevents dispatch and legacy rejection cannot enter recovery", async () => {
  const f = fixture();
  const prepared = await prepareReviewedCaliforniaCandidate(f.fresh(), f.deps);
  const before = f.calls.length;
  await assert.rejects(
    reviewPreparedCaliforniaCandidateForCollection(
      {
        ...f.fresh(),
        collectionId: randomUUID(),
        prepared,
        bounds: { maxModelCalls: 0, maxInputTokens: 1_000_000 },
      },
      f.deps,
    ),
    /model calls or input tokens/,
  );
  await assert.rejects(
    reviewPreparedCaliforniaCandidateForCollection(
      {
        ...f.fresh(),
        collectionId: randomUUID(),
        prepared: {
          ...prepared,
          reviewed: { ...prepared.reviewed, verdict: "reject" },
        },
      },
      f.deps,
    ),
    /previously approved/,
  );
  assert.equal(f.calls.length, before);
});

function retainedFixture(dossier: CandidateEvidenceDossier) {
  const narrative = californiaAuthorOutputSchema(
    californiaAuthorEvidence(dossier),
  ).parse({
    priorities: {
      claims: [
        {
          kind: "promise" as const,
          text: "Morgan Lee proposes funding public libraries.",
          evidenceIds: ["platform"],
          promiseDetails: null,
        },
      ],
    },
    record: { claims: [] },
    mechanisms: { claims: [] },
    effects: { claims: [] },
    tradeoffs: { claims: [] },
    unknowns: { claims: [] },
    terms: [],
  });
  return {
    dossierDigest: dossier.dossierDigest,
    narrative,
    semanticDigest: createHash("sha256")
      .update(JSON.stringify(narrative))
      .digest("hex"),
    publication: {
      revisionId: randomUUID(),
      authorRunId: randomUUID(),
      reviewerRunId: randomUUID(),
    },
  };
}
test("finance refresh cache binds narrative rather than changing publication run IDs", async () => {
  const f = fixture();
  const input = f.fresh();
  const retainedNarrative = retainedFixture(input.dossier);
  const first = await prepareReviewedCaliforniaCandidate(
    { ...input, retainedNarrative },
    f.deps,
  );
  assert.equal(
    first.authored.attestation.promptVersion,
    "california-finance-refresh-v2",
  );
  const count = f.calls.length;
  const second = await prepareReviewedCaliforniaCandidate(
    {
      ...f.fresh(),
      retainedNarrative: {
        ...retainedNarrative,
        publication: {
          revisionId: randomUUID(),
          authorRunId: randomUUID(),
          reviewerRunId: randomUUID(),
        },
      },
    },
    f.deps,
  );
  assert.equal(f.calls.length, count);
  assert.equal(
    first.authored.attestation.runId,
    second.authored.attestation.runId,
  );
});
test("unknown finance refresh dispatch remains terminal for identical semantic content", async () => {
  const f = fixture();
  const input = f.fresh();
  const retainedNarrative = retainedFixture(input.dossier);
  let dispatches = 0;
  f.deps.author = async () => {
    dispatches++;
    throw new Error("Unknown transport outcome");
  };
  await assert.rejects(
    prepareReviewedCaliforniaCandidate({ ...input, retainedNarrative }, f.deps),
    /Unknown transport outcome/,
  );
  await assert.rejects(
    prepareReviewedCaliforniaCandidate(
      { ...f.fresh(), retainedNarrative },
      f.deps,
    ),
    /Saved author failure|already reserved/,
  );
  assert.equal(dispatches, 1);
});
