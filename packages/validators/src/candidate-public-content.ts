import type { CandidateBrief } from "./candidate-brief";
import { candidateBriefSchema } from "./candidate-brief";
import { candidateFinanceSemanticProjection } from "./candidate-evidence-dossier";

export function canonicalCandidateValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalCandidateValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonicalCandidateValue(entry)]),
    );
  return value;
}
export function candidatePublicContentProjection(
  value: CandidateBrief,
): unknown {
  const {
    revisionId: _revision,
    supersedes: _supersedes,
    createdAt: _created,
    authorId: _author,
    authorship: _authorship,
    correction: _correction,
    evidence,
    research,
    ...content
  } = candidateBriefSchema.parse(value);
  return canonicalCandidateValue({
    ...content,
    evidence: evidence.map(({ retrievedAt: _retrieved, ...entry }) => entry),
    ...(research
      ? {
          research: {
            ...research,
            finance: candidateFinanceSemanticProjection(research.finance),
          },
        }
      : {}),
  });
}
