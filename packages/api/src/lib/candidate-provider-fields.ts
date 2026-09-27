import type { CanonicalCandidate } from "./candidate-sources/types";
import type { Candidate } from "./civic";
import { SOURCE_TIER_RANK } from "./candidate-sources/types";

/** Keep provider evidence when enrichment has a lower trust tier. */
export function retainCandidateProviderFields(
  provider: Candidate,
  enrichment: CanonicalCandidate,
): CanonicalCandidate {
  const result = { ...enrichment };
  const retained = new Set<string>();
  // These are the provider fields that the enrichment merge can overwrite.
  for (const field of [
    "incumbent",
    "candidateUrl",
    "email",
    "phone",
  ] as const) {
    if (provider[field] === undefined || enrichment[field] === undefined)
      continue;
    const original = provider.citations?.find(
      (citation) => citation.field === field,
    );
    const incoming = enrichment.citations.find(
      (citation) => citation.field === field,
    );
    const originalRank = Object.entries(SOURCE_TIER_RANK).find(
      ([tier]) => tier === original?.tier,
    )?.[1];
    if (
      originalRank !== undefined &&
      originalRank > (incoming ? SOURCE_TIER_RANK[incoming.tier] : 0)
    ) {
      delete result[field];
      retained.add(field);
    }
  }
  result.citations = enrichment.citations.filter(
    (citation) => !retained.has(citation.field),
  );
  return result;
}
