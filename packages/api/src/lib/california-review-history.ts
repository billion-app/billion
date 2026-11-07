import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod/v4";

import type { CandidateBrief } from "@acme/validators";
import { and, eq, inArray, isNull, or, sql } from "@acme/db";
import { CaliforniaResearchArtifact } from "@acme/db/schema";
import {
  candidateBriefIdentitySchema,
  candidateBriefSchema,
  candidateModelAttestationSchema,
  candidatePublicContentProjection,
  canonicalCandidateValue,
} from "@acme/validators";

import type { ResearchTransaction } from "./candidate-research-store";
import { briefDigest } from "./candidate-brief-publication";

const hash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonicalCandidateValue(value)))
    .digest("hex");
export const californiaReviewScopeSchema = z.object({
  raceKey: z.string().min(1),
  candidateId: z.string().min(1),
  dossierDigest: z.string().regex(/^[a-f0-9]{64}$/),
  sourceSetDigest: z.string().regex(/^[a-f0-9]{64}$/),
  policyVersion: z.string().min(1),
  identity: candidateBriefIdentitySchema,
});
export type CaliforniaReviewScope = z.infer<typeof californiaReviewScopeSchema>;
export const californiaHistoryAuthorSchema = z.object({
  brief: candidateBriefSchema,
  attestation: candidateModelAttestationSchema,
});
export const californiaHistoryReviewSchema = z.object({
  verdict: z.enum(["approve", "reject"]),
  overallReason: z.string().nullable().optional(),
  findings: z.array(
    z.object({
      claimId: z.string(),
      supported: z.boolean(),
      reason: z.string(),
    }),
  ),
  attestation: candidateModelAttestationSchema,
});
export interface CaliforniaHistoryArtifact {
  key: string;
  kind: string;
  raceKey: string;
  candidateId: string | null;
  document: unknown;
  createdAt: Date;
}
export type CaliforniaReviewHistory =
  | { kind: "complete"; proof: string; artifacts: CaliforniaHistoryArtifact[] }
  | { kind: "unavailable"; reason: string };
export type CaliforniaSemanticReviewAdmission =
  | { kind: "clear"; proof: string }
  | {
      kind: "rejected";
      authorKey: string;
      reviewKey: string;
      author: z.infer<typeof californiaHistoryAuthorSchema>;
      review: z.infer<typeof californiaHistoryReviewSchema>;
    }
  | { kind: "unavailable"; reason: string };
const historyKinds = [
  "author",
  "review",
  "model_dispatch",
  "model_failure",
  "model_correction",
  "model_review_collection_attempt",
  "model_correction_rejection",
  "model_review_rejection",
  "model_result_conflict",
];
export const candidatePublicContentDigest = (brief: CandidateBrief) =>
  hash(candidatePublicContentProjection(brief));
export async function lockCaliforniaReviewHistory(
  tx: ResearchTransaction,
  raceKey: string,
  candidateId: string,
) {
  await tx.execute(sql`select set_config('lock_timeout','3000',true)`);
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`california-review-history:${JSON.stringify([raceKey, candidateId])}`}))`,
  );
}
export async function readScopedCaliforniaReviewHistory(
  tx: ResearchTransaction,
  scope: CaliforniaReviewScope,
): Promise<CaliforniaReviewHistory> {
  const parsed = californiaReviewScopeSchema.parse(scope);
  await tx.execute(sql`select set_config('statement_timeout','3000',true)`);
  const metadata = await tx
    .select({
      key: CaliforniaResearchArtifact.key,
      kind: CaliforniaResearchArtifact.kind,
      raceKey: CaliforniaResearchArtifact.raceKey,
      candidateId: CaliforniaResearchArtifact.candidateId,
      createdAt: CaliforniaResearchArtifact.createdAt,
      bytes: sql<number>`pg_column_size(${CaliforniaResearchArtifact.document})`,
    })
    .from(CaliforniaResearchArtifact)
    .where(
      and(
        eq(CaliforniaResearchArtifact.raceKey, parsed.raceKey),
        or(
          eq(CaliforniaResearchArtifact.candidateId, parsed.candidateId),
          isNull(CaliforniaResearchArtifact.candidateId),
        ),
        inArray(CaliforniaResearchArtifact.kind, historyKinds),
      ),
    )
    .orderBy(
      CaliforniaResearchArtifact.createdAt,
      CaliforniaResearchArtifact.key,
    )
    .limit(513);
  if (metadata.length > 512)
    return {
      kind: "unavailable",
      reason: "Candidate model history exceeds the 512-row completeness bound",
    };
  if (metadata.reduce((sum, row) => sum + Number(row.bytes), 0) > 8_000_000)
    return {
      kind: "unavailable",
      reason: "Candidate model history exceeds the 8MB payload bound",
    };
  const sizes = metadata.length
    ? await tx
        .select({
          key: CaliforniaResearchArtifact.key,
          bytes: sql<number>`octet_length(${CaliforniaResearchArtifact.document}::text)`,
        })
        .from(CaliforniaResearchArtifact)
        .where(
          inArray(
            CaliforniaResearchArtifact.key,
            metadata.map((row) => row.key),
          ),
        )
    : [];
  if (
    sizes.length !== metadata.length ||
    sizes.reduce((sum, row) => sum + Number(row.bytes), 0) > 8_000_000
  )
    return {
      kind: "unavailable",
      reason:
        "Candidate model history exceeds its complete decoded payload bound",
    };
  const rows = metadata.length
    ? await tx
        .select()
        .from(CaliforniaResearchArtifact)
        .where(
          inArray(
            CaliforniaResearchArtifact.key,
            metadata.map((row) => row.key),
          ),
        )
    : [];
  const artifacts: CaliforniaHistoryArtifact[] = [];
  for (const meta of metadata) {
    const row = rows.find((row) => row.key === meta.key);
    if (!row)
      return {
        kind: "unavailable",
        reason: "Candidate model history changed during acquisition",
      };
    artifacts.push(row);
  }
  return {
    kind: "complete",
    proof: hash(
      artifacts.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    ),
    artifacts,
  };
}
function sameScope(
  attestation: Pick<
    z.infer<typeof candidateModelAttestationSchema>,
    "dossierDigest" | "sourceSetDigest" | "policyVersion"
  >,
  scope: CaliforniaReviewScope,
) {
  return (
    attestation.dossierDigest === scope.dossierDigest &&
    attestation.sourceSetDigest === scope.sourceSetDigest &&
    attestation.policyVersion === scope.policyVersion
  );
}
function sameRejectionContext(
  attestation: Pick<
    z.infer<typeof candidateModelAttestationSchema>,
    "sourceSetDigest" | "policyVersion"
  >,
  scope: CaliforniaReviewScope,
) {
  return (
    attestation.sourceSetDigest === scope.sourceSetDigest &&
    attestation.policyVersion === scope.policyVersion
  );
}
export function evaluateCaliforniaSemanticReview(input: {
  history: CaliforniaReviewHistory;
  scope: CaliforniaReviewScope;
  brief: CandidateBrief;
  now: string;
  collectionAuthor?: unknown;
}): CaliforniaSemanticReviewAdmission {
  if (input.history.kind !== "complete") return input.history;
  try {
    const scope = californiaReviewScopeSchema.parse(input.scope),
      brief = candidateBriefSchema.parse(input.brief),
      now = Date.parse(input.now);
    if (
      !Number.isFinite(now) ||
      !isDeepStrictEqual(brief.identity, scope.identity) ||
      scope.candidateId !== scope.identity.candidateId
    )
      throw new Error("Proposed review identity differs from its scope");
    const artifacts = input.history.artifacts;
    if (
      artifacts.some(
        (row) =>
          row.raceKey !== scope.raceKey ||
          row.candidateId !== scope.candidateId ||
          row.createdAt.getTime() > now,
      )
    )
      throw new Error(
        "Model history storage identity or chronology is invalid",
      );
    function parseAuthor(value: unknown) {
      const document = californiaHistoryAuthorSchema.parse(value),
        a = document.attestation;
      if (
        a.role !== "author" ||
        !isDeepStrictEqual(document.brief.identity, scope.identity) ||
        a.revisionDigest !== briefDigest(document.brief) ||
        a.actorId !== document.brief.authorId ||
        document.brief.authorship.kind !== "generated" ||
        document.brief.authorship.model !== a.actualModel ||
        document.brief.authorship.promptVersion !== a.promptVersion ||
        Date.parse(a.startedAt) > Date.parse(a.completedAt) ||
        Date.parse(a.completedAt) > now
      )
        throw new Error("Malformed immutable author history");
      return document;
    }
    const authors = artifacts
      .filter((row) => row.kind === "author")
      .map((row) => ({ row, document: parseAuthor(row.document) }));
    const collectionAuthor =
      input.collectionAuthor === undefined
        ? undefined
        : parseAuthor({ brief, attestation: input.collectionAuthor });
    if (collectionAuthor && !sameScope(collectionAuthor.attestation, scope))
      throw new Error(
        "Persisted collection author does not bind the proposed dossier and policy",
      );
    if (
      !collectionAuthor &&
      !authors.some(
        (author) =>
          sameScope(author.document.attestation, scope) &&
          briefDigest(author.document.brief) === briefDigest(brief),
      )
    )
      throw new Error(
        "Proposed review has no exact immutable author in history",
      );
    const reviews = artifacts
      .filter((row) => row.kind === "review")
      .map((row) => ({
        row,
        document: californiaHistoryReviewSchema.parse(row.document),
      }));
    for (const row of artifacts.filter(
      (row) =>
        row.kind === "model_correction_rejection" ||
        row.kind === "model_review_rejection",
    )) {
      const wrapper = z
        .object({
          reviewKey: z.string(),
          reviewed: californiaHistoryReviewSchema,
        })
        .parse(row.document);
      const canonical = reviews.find(
        (review) => review.row.key === wrapper.reviewKey,
      );
      if (
        wrapper.reviewed.verdict !== "reject" ||
        !canonical ||
        !isDeepStrictEqual(canonical.document, wrapper.reviewed)
      )
        throw new Error(
          "Rejected review history has missing or conflicting canonical linkage",
        );
    }
    for (const row of artifacts.filter(
      (row) => row.kind === "model_review_collection_attempt",
    )) {
      const attempt = z
        .object({ collectionId: z.uuid(), reviewKey: z.string().min(1) })
        .parse(row.document);
      if (
        !reviews.some((review) => review.row.key === attempt.reviewKey) &&
        !artifacts.some(
          (dispatch) =>
            dispatch.kind === "model_dispatch" &&
            dispatch.key === `dispatch:${attempt.reviewKey}`,
        )
      )
        throw new Error(
          "Collection review history has no canonical result or actual dispatch",
        );
    }
    for (const row of artifacts.filter(
      (row) => row.kind === "model_correction",
    )) {
      const plan = z
        .object({
          triggerArtifactKey: z.string().min(1),
          feedback: z
            .object({ kind: z.enum(["author_validation", "review_rejection"]) })
            .passthrough(),
        })
        .parse(row.document);
      if (
        plan.feedback.kind === "review_rejection" &&
        !reviews.some(
          (review) =>
            review.row.key === plan.triggerArtifactKey &&
            review.document.verdict === "reject",
        )
      )
        throw new Error(
          "Correction history has no canonical rejected reviewer result",
        );
      if (
        plan.feedback.kind === "author_validation" &&
        !artifacts.some(
          (artifact) =>
            artifact.key === plan.triggerArtifactKey &&
            (artifact.kind === "author" || artifact.kind === "model_failure"),
        )
      )
        throw new Error(
          "Correction history has no immutable author or failure evidence",
        );
    }
    if (artifacts.some((row) => row.kind === "model_result_conflict"))
      throw new Error("Conflicting model results require explicit resolution");
    for (const dispatch of artifacts.filter(
      (row) =>
        row.kind === "model_dispatch" && row.key.startsWith("dispatch:review:"),
    )) {
      const canonical = reviews.find(
        (review) => `dispatch:${review.row.key}` === dispatch.key,
      );
      if (canonical) {
        const timing = z
          .object({
            startedAt: z.iso.datetime(),
            reviewScope: californiaReviewScopeSchema.optional(),
          })
          .parse(dispatch.document);
        if (
          Date.parse(timing.startedAt) >
            Date.parse(canonical.document.attestation.startedAt) ||
          (timing.reviewScope &&
            (!sameScope(canonical.document.attestation, timing.reviewScope) ||
              timing.reviewScope.raceKey !== scope.raceKey ||
              timing.reviewScope.candidateId !== scope.candidateId))
        )
          throw new Error(
            "Canonical reviewer result conflicts with its actual dispatch scope or chronology",
          );
        continue;
      }
      const parsed = z
        .object({ reviewScope: californiaReviewScopeSchema })
        .safeParse(dispatch.document);
      if (
        parsed.success &&
        (parsed.data.reviewScope.raceKey !== scope.raceKey ||
          parsed.data.reviewScope.candidateId !== scope.candidateId ||
          !isDeepStrictEqual(parsed.data.reviewScope.identity, scope.identity))
      )
        throw new Error(
          "Unsettled reviewer dispatch has conflicting candidate or race identity",
        );
      if (
        !parsed.success ||
        sameRejectionContext(parsed.data.reviewScope, scope)
      )
        throw new Error(
          "A prior reviewer dispatch is unsettled or its canonical result is missing",
        );
    }
    for (const review of reviews) {
      const r = review.document.attestation;
      if (
        r.role !== "reviewer" ||
        Date.parse(r.startedAt) > Date.parse(r.completedAt) ||
        Date.parse(r.completedAt) > now
      )
        throw new Error("Malformed immutable reviewer history");
      const paired = authors.filter(
        (author) =>
          author.document.attestation.revisionDigest === r.revisionDigest &&
          author.document.attestation.dossierDigest === r.dossierDigest &&
          author.document.attestation.sourceSetDigest === r.sourceSetDigest &&
          author.document.attestation.policyVersion === r.policyVersion,
      );
      if (!paired.length)
        throw new Error("Reviewer history has no exact immutable author");
      if (
        paired.some(
          (author) =>
            author.document.attestation.actorId === r.actorId ||
            author.document.attestation.runId === r.runId ||
            Date.parse(author.document.attestation.completedAt) >
              Date.parse(r.startedAt),
        )
      )
        throw new Error("Reviewer history is not an independent invocation");
      if (
        review.document.verdict !== "reject" ||
        !sameRejectionContext(r, scope)
      )
        continue;
      const original = paired.find(
        (author) =>
          isDeepStrictEqual(author.document.brief.identity, scope.identity) &&
          candidatePublicContentDigest(author.document.brief) ===
            candidatePublicContentDigest(brief),
      );
      if (original)
        return {
          kind: "rejected",
          authorKey: original.row.key,
          reviewKey: review.row.key,
          author: original.document,
          review: review.document,
        };
    }
    return { kind: "clear", proof: input.history.proof };
  } catch (error) {
    return {
      kind: "unavailable",
      reason:
        error instanceof Error
          ? error.message
          : "Malformed candidate model history",
    };
  }
}

export async function assertCaliforniaSemanticReviewClear(
  tx: ResearchTransaction,
  scope: CaliforniaReviewScope,
  brief: CandidateBrief,
  collectionAuthor?: unknown,
) {
  await lockCaliforniaReviewHistory(tx, scope.raceKey, scope.candidateId);
  const history = await readScopedCaliforniaReviewHistory(tx, scope);
  const admission = evaluateCaliforniaSemanticReview({
    history,
    scope,
    brief,
    collectionAuthor,
    now: new Date().toISOString(),
  });
  if (admission.kind !== "clear")
    throw new Error(
      admission.kind === "rejected"
        ? "Immutable review history rejected this unchanged public content"
        : `Candidate review history unavailable: ${admission.reason}`,
    );
  return admission;
}
