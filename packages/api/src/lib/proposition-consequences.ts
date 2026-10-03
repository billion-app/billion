import { createHash } from "node:crypto";

import type { PropositionConsequences } from "@acme/validators";
import { propositionConsequencesSchema } from "@acme/validators";

import type { OfficialGuidePayload } from "./official-guide-cache";

type Measure = OfficialGuidePayload["measures"][number];

/** Fixed field order: retrieval refreshes alone do not change the source identity. */
export function propositionGuideSnapshot(
  electionDate: string,
  measure: Measure,
) {
  return JSON.stringify({
    electionDate,
    number: measure.number,
    title: measure.title,
    sourceUrl: measure.sourceUrl,
    officialSummary: measure.officialSummary ?? null,
    voteMeaningYes: measure.voteMeaningYes ?? null,
    voteMeaningNo: measure.voteMeaningNo ?? null,
    fiscalImpact: measure.fiscalImpact ?? null,
    proArguments: measure.proArguments ?? [],
    conArguments: measure.conArguments ?? [],
    fullTextUrl: measure.fullTextUrl ?? null,
  });
}

export function propositionGuideHash(electionDate: string, measure: Measure) {
  return createHash("sha256")
    .update(propositionGuideSnapshot(electionDate, measure))
    .digest("hex");
}

/** Empty until an editor approves a source-captured revision under #334.
 * Committed revisions are the bounded store; guide reads never generate or write.
 */
export const reviewedPropositionRevisions: readonly unknown[] = [];

export function publishedPropositionConsequences(
  electionDate: string,
  measure: Measure,
  revisions: readonly unknown[] = reviewedPropositionRevisions,
): PropositionConsequences | null {
  const hash = propositionGuideHash(electionDate, measure);
  // Explicit registry order makes rollback a reviewable change, not a timestamp race.
  for (const value of revisions) {
    const parsed = propositionConsequencesSchema.safeParse(value);
    if (!parsed.success) continue;
    const draft = parsed.data;
    if (
      draft.review.state !== "approved" ||
      draft.electionDate !== electionDate ||
      draft.number !== measure.number ||
      draft.officialTitle !== measure.title ||
      draft.officialUrl !== measure.sourceUrl ||
      draft.guideHash !== hash ||
      draft.review.guideHash !== hash ||
      draft.review.revision !== draft.revision ||
      Date.parse(draft.review.reviewedAt) < Date.parse(draft.generatedAt) ||
      !measure.officialSummary ||
      !measure.voteMeaningYes ||
      !measure.voteMeaningNo ||
      !measure.fiscalImpact
    )
      continue;
    const sources = new Map(draft.sources.map((source) => [source.id, source]));
    if (sources.size !== draft.sources.length) continue;
    // Require the actual captured guide record, not a URL attached to unrelated text.
    if (
      !draft.sources.some(
        (source) =>
          source.url === measure.sourceUrl &&
          source.snapshot === propositionGuideSnapshot(electionDate, measure),
      )
    )
      continue;
    const claims = [
      draft.headline,
      draft.currentRule,
      draft.yes,
      draft.no,
      ...(draft.decisionNote ? [draft.decisionNote] : []),
      ...(draft.decisionMap ? Object.values(draft.decisionMap) : []),
      ...draft.implementation,
      ...draft.affected,
      draft.costsAndFunding,
      draft.uncertainty,
    ];
    if (claims.some((claim) => claim.sourceIds.some((id) => !sources.has(id))))
      continue;
    // Internal evidence snapshots stay server-side; the router strips them below.
    return draft;
  }
  return null;
}

export function publicPropositionConsequences(
  draft: PropositionConsequences | null,
) {
  if (!draft) return null;
  return {
    ...draft,
    sources: draft.sources.map(({ snapshot: _snapshot, ...source }) => source),
  };
}
