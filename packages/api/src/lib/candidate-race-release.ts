import type { CandidateBrief, CandidateRaceManifest } from "@acme/validators";
import { candidateRaceManifestSchema } from "@acme/validators";

import { publishableRace } from "./candidate-brief-publication";

/** Set only after a named editorial owner approves a versioned publication policy. */
export const candidatePublicationPolicy = {
  approved: false,
  version: "pending",
};
export interface PublishedCandidateRace {
  manifest: CandidateRaceManifest;
  briefs: CandidateBrief[];
  reviewedAt: string;
}
export interface RaceReviewEvent {
  revisionId: string;
  actorId: string;
  action: string;
  policyVersion: string;
  createdAt: Date;
}
export interface RaceRevision {
  id: string;
  document: unknown;
  revisionDigest: string;
}
/** No I/O. A stale, changed, withdrawn or partial race never leaks individual briefs. */
export function readCandidateRace(input: {
  manifest: unknown;
  revokedReason: string | null;
  revisions: RaceRevision[];
  events: RaceReviewEvent[];
  now: string;
  policy: { approved: boolean; version: string };
}): PublishedCandidateRace | null {
  if (!input.policy.approved || input.revokedReason !== null) return null;
  const parsed = candidateRaceManifestSchema.safeParse(input.manifest);
  if (!parsed.success) return null;
  const race = parsed.data;
  const now = Date.parse(input.now);
  if (
    !Number.isFinite(now) ||
    race.policyVersion !== input.policy.version ||
    Date.parse(race.expiresAt) <= now ||
    Date.parse(race.sourceCheckedAt) > now ||
    Date.parse(race.rosterVerifiedAt) > now
  )
    return null;
  const revisions = race.members.map((member) =>
    input.revisions.find((r) => r.id === member.revisionId),
  );
  if (revisions.some((r) => !r)) return null;
  const reviews = race.members.flatMap((member) => {
    const revision = revisions.find((r) => r?.id === member.revisionId);
    return input.events
      .filter(
        (e) => e.revisionId === member.revisionId && e.action === "approve",
      )
      .map((e) => ({
        candidateId: member.candidateId,
        revisionDigest: revision?.revisionDigest ?? "",
        reviewerId: e.actorId,
        reviewedAt: e.createdAt.toISOString(),
        policyVersion: e.policyVersion,
      }));
  });
  const result = publishableRace(
    revisions.map((r) => r?.document),
    {
      policy: input.policy,
      roster: {
        verified: true,
        candidateIds: race.members.map((m) => m.candidateId),
        contestId: race.contestId,
        jurisdiction: race.jurisdiction,
        electionDate: race.electionDate,
      },
      reviews,
      currentHashes: race.currentHashes,
      withdrawnRevisionIds: input.events
        .filter((e) => e.action === "withdraw")
        .map((e) => e.revisionId),
      now: input.now,
    },
  );
  if (
    result.status !== "published" ||
    result.briefs.some(
      (brief) =>
        race.members.find((m) => m.candidateId === brief.identity.candidateId)
          ?.revisionId !== brief.revisionId,
    )
  )
    return null;
  return {
    manifest: race,
    briefs: result.briefs,
    reviewedAt:
      reviews
        .map((r) => r.reviewedAt)
        .sort()
        .at(-1) ?? input.now,
  };
}
