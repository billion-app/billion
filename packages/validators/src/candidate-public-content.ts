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
    sections,
    ...content
  } = candidateBriefSchema.parse(value);
  const claimIds = new Map(
    sections.flatMap((section) =>
      section.claims.map((claim, index) => [
        claim.id,
        `claim:${section.topic}:${index}`,
      ]),
    ),
  );
  const evidenceIds = new Map(
    evidence.map((entry, index) => [entry.id, `evidence:${index}`]),
  );
  function evidenceReferences(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(evidenceReferences);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          (key === "evidenceIds" || key === "filingEvidenceIds") &&
          Array.isArray(item)
            ? item.map((id: unknown) =>
                typeof id === "string" ? evidenceIds.get(id) : id,
              )
            : evidenceReferences(item),
        ]),
      );
    return value;
  }
  return canonicalCandidateValue({
    ...content,
    sections: sections.map((section) => ({
      ...section,
      claims: section.claims.map((claim, index) => ({
        ...claim,
        id: `claim:${section.topic}:${index}`,
        evidenceIds: claim.evidenceIds.map((id) => evidenceIds.get(id)),
      })),
    })),
    evidence: evidence.map(({ retrievedAt: _retrieved, ...entry }, index) => ({
      ...entry,
      id: `evidence:${index}`,
    })),
    ...(research
      ? {
          research: evidenceReferences({
            ...research,
            ...(research.headlineClaimId === undefined
              ? {}
              : { headlineClaimId: claimIds.get(research.headlineClaimId) }),
            promises: research.promises.map((promise) => ({
              ...promise,
              claimId: claimIds.get(promise.claimId),
            })),
            finance: candidateFinanceSemanticProjection(research.finance),
          }),
        }
      : {}),
  });
}
