export const FEATURED_BILL_LIMIT = 6;
export const FEATURED_BILL_RECENT_DAYS = 90;

export interface FeaturedBillCandidate {
  id: string;
  interestScore: number;
  controversyScore: number;
  attentionScore: number;
  activityAt: Date;
}

export function featuredBillScore(
  candidate: Pick<
    FeaturedBillCandidate,
    "interestScore" | "controversyScore" | "attentionScore"
  >,
): number {
  return (
    candidate.interestScore * 0.5 +
    candidate.controversyScore * 0.3 +
    candidate.attentionScore * 0.2
  );
}

/**
 * Keep the ranking rules independent from Postgres so selection is deterministic
 * and can be verified without a production database.
 */
export function rankFeaturedBillCandidates<T extends FeaturedBillCandidate>(
  candidates: readonly T[],
  now = new Date(),
): T[] {
  const recentCutoff =
    now.getTime() - FEATURED_BILL_RECENT_DAYS * 24 * 60 * 60 * 1000;

  return candidates
    .filter((candidate) => {
      const score = featuredBillScore(candidate);
      const isRecent = candidate.activityAt.getTime() >= recentCutoff;
      return candidate.interestScore >= 60 && (isRecent || score >= 75);
    })
    .sort((a, b) => {
      const scoreDifference = featuredBillScore(b) - featuredBillScore(a);
      if (scoreDifference !== 0) return scoreDifference;

      const attentionDifference = b.attentionScore - a.attentionScore;
      if (attentionDifference !== 0) return attentionDifference;

      const activityDifference =
        b.activityAt.getTime() - a.activityAt.getTime();
      if (activityDifference !== 0) return activityDifference;

      return b.id.localeCompare(a.id);
    });
}
