import { randomUUID } from "node:crypto";

import {
  candidateBriefSchema,
  candidateModelAttestationSchema,
} from "@acme/validators";

import type {
  CaliforniaHistoryArtifact,
  CaliforniaReviewScope,
} from "./california-review-history";
import { briefDigest } from "./candidate-brief-publication";

export function candidateReviewHistoryFixture() {
  const token = randomUUID(),
    now = new Date(Date.now() - 1000).toISOString();
  const identity = {
    candidateId: `candidate-${token}`,
    contestId: `contest-${token}`,
    jurisdiction: "ocd-division/country:us/state:ca",
    electionDate: "2026-11-03",
  };
  const brief = candidateBriefSchema.parse({
    schemaVersion: 1,
    identity,
    revisionId: randomUUID(),
    supersedes: null,
    createdAt: now,
    authorId: `author-${token}`,
    authorship: {
      kind: "generated",
      model: "fixture-author",
      promptVersion: "writer-17",
    },
    correction: null,
    evidence: [
      {
        id: "platform",
        url: "https://campaign.example/plan",
        publisher: "Fixture campaign",
        locator: "Plan",
        retrievedAt: now,
        documentDate: null,
        contentHash: "a".repeat(64),
        excerpt: "Fixture candidate proposes more library funding.",
        origin: "candidate",
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
      missingEvidence:
        topic === "priorities"
          ? null
          : "No further supported evidence in this fixture.",
      claims:
        topic === "priorities"
          ? [
              {
                id: "priorities-1",
                kind: "promise",
                text: "The campaign proposes more library funding.",
                evidenceIds: ["platform"],
              },
            ]
          : [],
    })),
  });
  const scope: CaliforniaReviewScope = {
    raceKey: `race-${token}`,
    candidateId: identity.candidateId,
    dossierDigest: "b".repeat(64),
    sourceSetDigest: "c".repeat(64),
    policyVersion: "policy",
    identity,
  };
  const authorAttestation = candidateModelAttestationSchema.parse({
    role: "author",
    actorId: brief.authorId,
    runId: randomUUID(),
    configuredModel: "fixture-author",
    actualModel: "fixture-author",
    provider: "fixture",
    requestId: "fixture-author-request",
    promptVersion: "writer-17",
    policyVersion: scope.policyVersion,
    dossierDigest: scope.dossierDigest,
    sourceSetDigest: scope.sourceSetDigest,
    revisionDigest: briefDigest(brief),
    startedAt: now,
    completedAt: now,
    usage: { inputTokens: 1, outputTokens: 1 },
    costUsd: null,
  });
  const author = { brief, attestation: authorAttestation };
  const review = {
    verdict: "reject" as "approve" | "reject",
    overallReason:
      "The claimed result is not supported by this campaign proposal.",
    findings: [
      {
        claimId: "priorities-1",
        supported: false,
        reason: "This campaign proposal is not an achieved result.",
      },
    ],
    attestation: {
      ...authorAttestation,
      role: "reviewer" as const,
      actorId: `reviewer-${token}`,
      runId: randomUUID(),
      actualModel: "fixture-reviewer",
      configuredModel: "fixture-reviewer",
      requestId: "fixture-reviewer-request",
      promptVersion: "reviewer-6",
    },
  };
  const row = (
    key: string,
    kind: string,
    document: unknown,
  ): CaliforniaHistoryArtifact => ({
    key,
    kind,
    document,
    raceKey: scope.raceKey,
    candidateId: scope.candidateId,
    createdAt: new Date(now),
  });
  return {
    scope,
    brief,
    author,
    review,
    now: new Date().toISOString(),
    row,
    artifacts: [
      row("author:legacy", "author", author),
      row("review:legacy", "review", review),
    ],
  };
}
