import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  candidatePublicContentDigest,
  evaluateCaliforniaSemanticReview,
} from "./california-review-history";
import { candidateReviewHistoryFixture } from "./california-review-history.fixture";
import { briefDigest } from "./candidate-brief-publication";

function required<T>(value: T | undefined): T {
  assert.ok(value);
  return value;
}
for (const metadata of [
  "revision",
  "author",
  "timestamp",
  "prompt",
  "key_order",
] as const)
  void test(`same reader content retains a canonical legacy rejection after ${metadata} metadata changes`, () => {
    const f = candidateReviewHistoryFixture(),
      brief = structuredClone(f.brief);
    if (metadata === "revision") brief.revisionId = randomUUID();
    if (metadata === "author") brief.authorId = "new-author";
    if (metadata === "timestamp") {
      brief.createdAt = f.now;
      required(brief.evidence[0]).retrievedAt = f.now;
    }
    if (metadata === "prompt")
      brief.authorship = {
        kind: "generated",
        model: "new-model",
        promptVersion: "writer-18",
      };
    const author = {
      brief,
      attestation: {
        ...f.author.attestation,
        revisionDigest: briefDigest(brief),
        actorId: brief.authorId,
        promptVersion:
          brief.authorship.kind === "generated"
            ? brief.authorship.promptVersion
            : "",
        actualModel:
          brief.authorship.kind === "generated" ? brief.authorship.model : "",
      },
    };
    if (metadata === "key_order")
      author.attestation = Object.fromEntries(
        Object.entries(author.attestation).reverse(),
      ) as typeof author.attestation;
    const result = evaluateCaliforniaSemanticReview({
      scope: f.scope,
      brief,
      now: f.now,
      history: {
        kind: "complete",
        proof: "proof",
        artifacts: [...f.artifacts, f.row("author:new", "author", author)],
      },
    });
    assert.equal(result.kind, "rejected");
    assert.equal(
      candidatePublicContentDigest(brief),
      candidatePublicContentDigest(f.brief),
    );
  });
for (const content of ["claim", "chapter", "citation", "context"] as const)
  void test(`genuine ${content} change may receive a new review`, () => {
    const f = candidateReviewHistoryFixture(),
      author = structuredClone(f.author);
    author.brief.revisionId = randomUUID();
    if (content === "claim")
      required(required(author.brief.sections[0]).claims[0]).text =
        "The campaign proposes some additional library funding.";
    if (content === "chapter") {
      required(author.brief.sections[1]).claims = required(
        author.brief.sections[0],
      ).claims;
      required(author.brief.sections[0]).claims = [];
      required(author.brief.sections[0]).missingEvidence =
        "This prior description belongs in Record, not Priorities.";
    }
    if (content === "citation")
      required(author.brief.evidence[0]).url =
        "https://campaign.example/updated-plan";
    if (content === "context")
      required(author.brief.evidence[0]).excerpt +=
        " This is a proposal, not an achieved result.";
    author.attestation.revisionDigest = briefDigest(author.brief);
    const result = evaluateCaliforniaSemanticReview({
      scope: f.scope,
      brief: author.brief,
      now: f.now,
      history: {
        kind: "complete",
        proof: "proof",
        artifacts: [...f.artifacts, f.row("author:new", "author", author)],
      },
    });
    assert.equal(result.kind, "clear");
  });
for (const failure of [
  "orphan",
  "bad_author_hash",
  "missing_result",
  "missing_failure_result",
  "conflicting_result",
  "malformed_wrapper",
] as const)
  void test(`uncertain ${failure} history fails closed`, () => {
    const f = candidateReviewHistoryFixture();
    if (failure === "orphan") f.artifacts.shift();
    if (failure === "bad_author_hash")
      f.author.attestation.revisionDigest = "f".repeat(64);
    if (failure === "missing_result" || failure === "missing_failure_result")
      f.artifacts.push(
        f.row("dispatch:review:lost", "model_dispatch", { startedAt: f.now }),
      );
    if (failure === "missing_failure_result")
      f.artifacts.push(
        f.row("failure:review:lost", "model_failure", { errorKind: "unknown" }),
      );
    if (failure === "conflicting_result")
      f.artifacts.push(f.row("conflict", "model_result_conflict", {}));
    if (failure === "malformed_wrapper")
      f.artifacts.push(
        f.row("rejected", "model_review_rejection", {
          reviewKey: "review:missing",
          reviewed: f.review,
        }),
      );
    const result = evaluateCaliforniaSemanticReview({
      scope: f.scope,
      brief: f.brief,
      now: f.now,
      history: { kind: "complete", proof: "proof", artifacts: f.artifacts },
    });
    assert.equal(result.kind, "unavailable");
  });
void test("genuinely different dossier and policy history does not create an unrelated rejection", () => {
  const f = candidateReviewHistoryFixture(),
    author = structuredClone(f.author);
  author.attestation.dossierDigest = "d".repeat(64);
  author.attestation.sourceSetDigest = "e".repeat(64);
  author.attestation.policyVersion = "new-policy";
  const scope = {
    ...f.scope,
    dossierDigest: author.attestation.dossierDigest,
    sourceSetDigest: author.attestation.sourceSetDigest,
    policyVersion: author.attestation.policyVersion,
  };
  const result = evaluateCaliforniaSemanticReview({
    scope,
    brief: author.brief,
    now: f.now,
    history: {
      kind: "complete",
      proof: "proof",
      artifacts: [
        ...f.artifacts,
        f.row("author:new-dossier", "author", author),
        f.row("dispatch:review:other-scope", "model_dispatch", {
          reviewScope: f.scope,
        }),
      ],
    },
  });
  assert.equal(result.kind, "clear");
});

void test("a persisted collection author can bind the proposal without standing in for historical authors", () => {
  const f = candidateReviewHistoryFixture();
  const clear = evaluateCaliforniaSemanticReview({
    scope: f.scope,
    brief: f.brief,
    collectionAuthor: f.author.attestation,
    now: f.now,
    history: { kind: "complete", proof: "proof", artifacts: [] },
  });
  assert.equal(clear.kind, "clear");
  const orphan = evaluateCaliforniaSemanticReview({
    scope: f.scope,
    brief: f.brief,
    collectionAuthor: f.author.attestation,
    now: f.now,
    history: {
      kind: "complete",
      proof: "proof",
      artifacts: [f.row("review:orphan", "review", f.review)],
    },
  });
  assert.equal(orphan.kind, "unavailable");
});
for (const field of [
  "actorId",
  "dossierDigest",
  "sourceSetDigest",
  "policyVersion",
  "revisionDigest",
  "actualModel",
  "promptVersion",
  "role",
  "completedAt",
] as const)
  void test(`persisted proposed-author fallback rejects mismatched ${field}`, () => {
    const f = candidateReviewHistoryFixture(),
      author = { ...f.author.attestation };
    if (
      field === "dossierDigest" ||
      field === "sourceSetDigest" ||
      field === "revisionDigest"
    )
      author[field] = "f".repeat(64);
    else if (field === "role") author.role = "reviewer";
    else if (field === "completedAt")
      author.completedAt = new Date(Date.parse(f.now) + 10000).toISOString();
    else author[field] = "wrong-author-binding";
    const result = evaluateCaliforniaSemanticReview({
      scope: f.scope,
      brief: f.brief,
      collectionAuthor: author,
      now: f.now,
      history: { kind: "complete", proof: "proof", artifacts: [] },
    });
    assert.equal(result.kind, "unavailable");
  });
void test("a collection without complete author invocation evidence cannot use the fallback", () => {
  const f = candidateReviewHistoryFixture();
  assert.equal(
    evaluateCaliforniaSemanticReview({
      scope: f.scope,
      brief: f.brief,
      collectionAuthor: { runId: randomUUID() },
      now: f.now,
      history: { kind: "complete", proof: "proof", artifacts: [] },
    }).kind,
    "unavailable",
  );
});
