import { createHash } from "node:crypto";

import type {
  ContextClaim,
  PropositionContext,
  PublicPropositionContext,
} from "@acme/validators";
import { propositionContextSchema } from "@acme/validators";

import type { OfficialGuidePayload } from "./official-guide-cache";
import {
  propositionGuideHash,
  propositionGuideSnapshot,
} from "./proposition-consequences";

type Measure = OfficialGuidePayload["measures"][number];
// Adding records here requires editorial approval under #334/#409. Pilot drafts
// are evidence artifacts, not production fallbacks. Reads do no research or writes.
export const reviewedContextRevisions: readonly unknown[] = [];
/** Latest adopted captures. Refreshing a source here invalidates dependent revisions. */
export const currentContextSources: readonly PropositionContext["sources"][number][] =
  [];

export function contextContentHash(value: PropositionContext): string {
  const { review: _review, ...content } = propositionContextSchema.parse(value);
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}
export function contextClaims(value: PropositionContext): ContextClaim[] {
  return [
    value.takeaway,
    value.today,
    value.change,
    value.rationale,
    ...value.terms.map((item) => item.meaning),
    ...value.chain.map((item) => item.action),
    ...value.tradeoffs,
    ...value.unknowns.map((item) => item.claim),
    ...value.magnitude.flatMap((item) => [item.amount, item.comparison]),
    ...value.history.flatMap((item) => [
      item.finding,
      item.followThrough,
      item.outcome,
      item.limit,
    ]),
    ...value.scenarios.map((item) => item.claim),
    ...value.questions.map((item) => item.path),
  ];
}
export function validateContextEvidence(value: PropositionContext): boolean {
  const sources = new Map(value.sources.map((item) => [item.id, item]));
  return (
    sources.size === value.sources.length &&
    value.sources.some((item) => item.layer === "legal-text") &&
    contextClaims(value).every((claim) =>
      [
        ...claim.evidence,
        ...(claim.money ?? []).flatMap((item) =>
          item.comparison.state === "available"
            ? item.comparison.denominator.evidence
            : [],
        ),
      ].every((ref) => sources.has(ref.sourceId)),
    )
  );
}
export function publishedPropositionContext(
  electionDate: string,
  measure: Measure,
  revisions: readonly unknown[] = reviewedContextRevisions,
  currentSources: readonly PropositionContext["sources"][number][] = currentContextSources,
): PublicPropositionContext | null {
  const guideHash = propositionGuideHash(electionDate, measure);
  for (const raw of revisions) {
    const parsed = propositionContextSchema.safeParse(raw);
    if (!parsed.success) continue;
    const value = parsed.data;
    if (
      value.review.state !== "approved" ||
      value.electionDate !== electionDate ||
      value.number !== measure.number ||
      value.officialTitle !== measure.title ||
      value.officialUrl !== measure.sourceUrl ||
      value.guideHash !== guideHash ||
      value.review.revision !== value.revision ||
      value.review.contentHash !== contextContentHash(value) ||
      Date.parse(value.review.reviewedAt) < Date.parse(value.preparedAt) ||
      value.sources.some(
        (source) =>
          Date.parse(source.retrievedAt) >
          Date.parse(
            value.review.state === "approved"
              ? value.review.reviewedAt
              : value.preparedAt,
          ),
      ) ||
      !measure.fullTextUrl ||
      !value.sources.some(
        (source) =>
          source.layer === "legal-text" && source.url === measure.fullTextUrl,
      ) ||
      !validateContextEvidence(value) ||
      !value.sources.every((source) => {
        const captures = currentSources.filter(
          (current) =>
            current.url === source.url && current.layer === source.layer,
        );
        return (
          captures.length === 1 && captures[0]?.snapshot === source.snapshot
        );
      }) ||
      !value.sources.some(
        (source) =>
          source.url === measure.sourceUrl &&
          source.snapshot === propositionGuideSnapshot(electionDate, measure),
      )
    )
      continue;
    return publicPropositionContext(value);
  }
  return null;
}
export function publicPropositionContext(
  value: PropositionContext,
): PublicPropositionContext {
  return {
    ...value,
    sources: value.sources.map(({ snapshot: _snapshot, ...source }) => source),
  };
}
