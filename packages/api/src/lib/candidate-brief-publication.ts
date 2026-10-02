import { createHash } from "node:crypto";

import type { CandidateBriefIdentity } from "@acme/validators";
import { candidateBriefSchema } from "@acme/validators";

export function briefIdentityKey(identity: CandidateBriefIdentity): string {
  return JSON.stringify([
    identity.jurisdiction,
    identity.electionDate,
    identity.contestId,
    identity.candidateId,
  ]);
}
export function briefDigest(value: unknown): string {
  // Validated schema fixes object-key order; the approval binds every claim and source.
  return createHash("sha256")
    .update(JSON.stringify(candidateBriefSchema.parse(value)))
    .digest("hex");
}
export interface PublicationContext {
  policy: { approved: boolean; version: string };
  roster: { verified: boolean; candidateIds: string[] };
  reviews: {
    candidateId: string;
    revisionDigest: string;
    reviewerId: string;
    reviewedAt: string;
    policyVersion: string;
  }[];
  currentHashes: Record<string, string>;
  withdrawnRevisionIds: string[];
  now: string;
}
/** All-or-nothing race release. Pure validation never generates or fetches content. */
export function publishableRace(
  values: unknown[],
  context: PublicationContext,
) {
  if (!context.policy.approved)
    return { status: "policy_pending" as const, briefs: [] };
  if (!Number.isFinite(Date.parse(context.now)))
    return { status: "invalid" as const, briefs: [] };
  const parsed = values.map((value) => candidateBriefSchema.safeParse(value));
  if (parsed.some((result) => !result.success))
    return { status: "invalid" as const, briefs: [] };
  const briefs = parsed.flatMap((result) =>
    result.success ? [result.data] : [],
  );
  const keys = new Set(briefs.map((brief) => brief.identity.candidateId));
  const first = briefs[0];
  if (
    !first ||
    !context.roster.verified ||
    keys.size !== briefs.length ||
    new Set(context.roster.candidateIds).size !==
      context.roster.candidateIds.length ||
    keys.size !== context.roster.candidateIds.length ||
    context.roster.candidateIds.some((id) => !keys.has(id)) ||
    briefs.some(
      (brief) =>
        brief.identity.contestId !== first.identity.contestId ||
        brief.identity.jurisdiction !== first.identity.jurisdiction ||
        brief.identity.electionDate !== first.identity.electionDate,
    )
  )
    return { status: "incomplete_race" as const, briefs: [] };
  for (const brief of briefs) {
    if (context.withdrawnRevisionIds.includes(brief.revisionId))
      return { status: "withdrawn" as const, briefs: [] };
    if (
      brief.evidence.some(
        (e) =>
          context.currentHashes[e.id] !== e.contentHash ||
          Date.parse(e.retrievedAt) > Date.parse(context.now),
      )
    )
      return { status: "stale" as const, briefs: [] };
    const review = context.reviews.find(
      (r) =>
        r.candidateId === brief.identity.candidateId &&
        r.revisionDigest === briefDigest(brief) &&
        r.policyVersion === context.policy.version,
    );
    if (
      !review ||
      review.reviewerId === brief.authorId ||
      !Number.isFinite(Date.parse(review.reviewedAt)) ||
      Date.parse(review.reviewedAt) < Date.parse(brief.createdAt) ||
      Date.parse(review.reviewedAt) > Date.parse(context.now)
    )
      return { status: "review_pending" as const, briefs: [] };
  }
  return { status: "published" as const, briefs };
}
