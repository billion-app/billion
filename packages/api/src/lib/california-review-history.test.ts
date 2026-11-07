import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { campaignFinanceSchema, candidateBriefSchema } from "@acme/validators";

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

void test("coherent claim ID renaming preserves the rejected claim graph including headline and promise references", () => {
  const f = candidateReviewHistoryFixture();
  const claim = required(required(f.brief.sections[0]).claims[0]);
  const point = {
    title: "Library funding",
    text: "The campaign proposes more library funding.",
    emphasis: [],
    evidenceIds: ["platform"],
  };
  f.brief.research = {
    headlineClaimId: claim.id,
    promises: [
      {
        claimId: claim.id,
        title: "Library funding",
        brief: { change: point, authority: point, unknowns: point },
        benefits: [],
        costs: [],
        affected: [],
        perspectives: [],
        steps: [],
        alternatives: [],
        unknowns: [],
      },
    ],
    finance: null,
    financeGap: "No finance research is present in this fixture.",
  };
  f.author.attestation.revisionDigest = briefDigest(f.brief);
  f.review.attestation.revisionDigest = briefDigest(f.brief);
  const renamed = structuredClone(f.author);
  renamed.brief.revisionId = randomUUID();
  const selected = required(required(renamed.brief.sections[0]).claims[0]);
  selected.id = "opaque-nonce-claim";
  const research = required(renamed.brief.research);
  research.headlineClaimId = selected.id;
  required(research.promises[0]).claimId = selected.id;
  renamed.attestation.revisionDigest = briefDigest(renamed.brief);
  assert.notEqual(
    renamed.attestation.revisionDigest,
    f.author.attestation.revisionDigest,
  );
  assert.equal(
    candidatePublicContentDigest(renamed.brief),
    candidatePublicContentDigest(f.brief),
  );
  const admission = evaluateCaliforniaSemanticReview({
    scope: f.scope,
    brief: renamed.brief,
    now: f.now,
    history: {
      kind: "complete",
      proof: "proof",
      artifacts: [...f.artifacts, f.row("author:renamed", "author", renamed)],
    },
  });
  assert.equal(admission.kind, "rejected");
});
void test("claim ID normalization preserves graph targets, chapter ordering and literal prose", () => {
  const f = candidateReviewHistoryFixture();
  const first = required(required(f.brief.sections[0]).claims[0]);
  const second = {
    ...first,
    id: "second-claim",
    text: "The campaign also proposes more school funding.",
  };
  required(f.brief.sections[0]).claims.push(second);
  f.brief.research = {
    headlineClaimId: first.id,
    promises: [],
    finance: null,
    financeGap: "No finance research is present in this fixture.",
  };
  const digest = candidatePublicContentDigest(f.brief);
  const headline = structuredClone(f.brief);
  required(headline.research).headlineClaimId = second.id;
  assert.notEqual(candidatePublicContentDigest(headline), digest);
  const order = structuredClone(f.brief);
  required(order.sections[0]).claims.reverse();
  assert.notEqual(candidatePublicContentDigest(order), digest);
  const text = structuredClone(f.brief);
  required(required(text.sections[0]).claims[0]).text = first.id;
  assert.notEqual(candidatePublicContentDigest(text), digest);
});

for (const prior of ["rejected", "unsettled"] as const)
  void test(`private dossier-only changes cannot bypass ${prior} history with the same actual source set`, () => {
    const f = candidateReviewHistoryFixture();
    const newer = structuredClone(f.author);
    newer.brief.revisionId = randomUUID();
    newer.attestation.dossierDigest = "d".repeat(64);
    newer.attestation.revisionDigest = briefDigest(newer.brief);
    const scope = {
      ...f.scope,
      dossierDigest: newer.attestation.dossierDigest,
    };
    const artifacts =
      prior === "rejected"
        ? [...f.artifacts, f.row("author:new-gap", "author", newer)]
        : [
            required(f.artifacts[0]),
            f.row("author:new-gap", "author", newer),
            f.row("dispatch:review:old-gap", "model_dispatch", {
              startedAt: f.now,
              reviewScope: f.scope,
            }),
          ];
    const result = evaluateCaliforniaSemanticReview({
      scope,
      brief: newer.brief,
      now: f.now,
      history: { kind: "complete", proof: "proof", artifacts },
    });
    assert.equal(
      result.kind,
      prior === "rejected" ? "rejected" : "unavailable",
    );
  });

void test("coherent evidence ID graph renaming includes promises, financial observations, donors and outside spending", () => {
  const f = candidateReviewHistoryFixture();
  const first = required(f.brief.evidence[0]);
  f.brief.evidence.push({ ...first, id: "finance", origin: "primary_record" });
  const point = {
    title: "Fixture context",
    text: "The fixture does not establish influence.",
    emphasis: [],
    evidenceIds: ["finance"],
  };
  const window = {
    periodStart: "2026-01-01",
    periodEnd: "2026-10-01",
    updatedAt: f.now,
    evidenceIds: ["finance"],
  };
  const finance = campaignFinanceSchema.parse({
    committeeId: "C00000001",
    committeeName: "Synthetic committee",
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    currency: "USD",
    coverage: "partial",
    coverageNote: "Synthetic graph fixture.",
    updatedAt: f.now,
    filingEvidenceIds: ["finance"],
    receipts: null,
    donors: [
      {
        id: "donor-entity",
        name: "Synthetic donor",
        type: "individual",
        amountCents: 100,
        evidenceIds: ["finance"],
        lobbying: point,
        interests: [{ area: "education", evidenceIds: ["finance"] }],
        positions: [point],
      },
    ],
    donorCoverage: "selected",
    donorAmounts: "contribution",
    outsideSpending: [
      {
        id: "outside-entity",
        spender: "Synthetic spender",
        direction: "support",
        amountCents: 100,
        evidenceIds: ["finance"],
      },
    ],
    observation: {
      schemaVersion: 1,
      summary: {
        status: "unavailable",
        reason: "Not reported in this fixture.",
        evidenceIds: ["finance"],
      },
      donorSelection: {
        status: "available",
        ...window,
        basis: "selected_filing_transactions",
        selection: "Synthetic transaction",
        filingNumbers: [1],
        limit: 1,
      },
      independentExpenditures: {
        status: "available",
        ...window,
        basis: "processed_periodic_reports",
        completeness: "complete",
        supportCents: 100,
        opposeCents: 0,
        transactionCount: 1,
      },
      filingStatus: {
        status: "available",
        ...window,
        basis: "official_filing_index",
        kind: "financial_reports",
        latestForm: "F3",
        observedForms: ["F3"],
        statement: null,
      },
    },
  });
  f.brief.research = {
    headlineClaimId: "priorities-1",
    promises: [
      {
        claimId: "priorities-1",
        title: "Synthetic proposal",
        brief: { change: point, authority: point, unknowns: point },
        benefits: [point],
        costs: [point],
        affected: [point],
        perspectives: [point],
        steps: [point],
        alternatives: [point],
        unknowns: [point],
      },
    ],
    finance,
    financeGap: null,
  };
  f.author.attestation.revisionDigest = briefDigest(f.brief);
  f.review.attestation.revisionDigest = briefDigest(f.brief);
  const names = new Map(
    f.brief.evidence.map((entry, index) => [
      entry.id,
      `opaque-evidence-${index}`,
    ]),
  );
  const refs = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(refs)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
              key,
              (key === "evidenceIds" || key === "filingEvidenceIds") &&
              Array.isArray(item)
                ? item.map((id: unknown) =>
                    typeof id === "string" ? names.get(id) : id,
                  )
                : refs(item),
            ]),
          )
        : value;
  const renamed = structuredClone(f.author);
  renamed.brief = candidateBriefSchema.parse(
    refs({
      ...renamed.brief,
      evidence: renamed.brief.evidence.map((entry) => ({
        ...entry,
        id: names.get(entry.id),
      })),
    }),
  );
  renamed.brief.revisionId = randomUUID();
  renamed.attestation.dossierDigest = "d".repeat(64);
  renamed.attestation.revisionDigest = briefDigest(renamed.brief);
  assert.equal(
    candidatePublicContentDigest(renamed.brief),
    candidatePublicContentDigest(f.brief),
  );
  const scope = {
    ...f.scope,
    dossierDigest: renamed.attestation.dossierDigest,
  };
  assert.equal(
    evaluateCaliforniaSemanticReview({
      scope,
      brief: renamed.brief,
      now: f.now,
      history: {
        kind: "complete",
        proof: "proof",
        artifacts: [
          ...f.artifacts,
          f.row("author:evidence-alias", "author", renamed),
        ],
      },
    }).kind,
    "rejected",
  );
  const retarget = structuredClone(f.brief);
  required(required(retarget.sections[0]).claims[0]).evidenceIds = ["finance"];
  assert.notEqual(
    candidatePublicContentDigest(retarget),
    candidatePublicContentDigest(f.brief),
  );
  const donor = structuredClone(f.brief);
  const donorFinance = required(donor.research).finance;
  assert.ok(donorFinance);
  required(donorFinance.donors[0]).id = "different-real-entity";
  assert.notEqual(
    candidatePublicContentDigest(donor),
    candidatePublicContentDigest(f.brief),
  );
});
