import type { CanonicalCandidate } from "./candidate-sources/types";
import type { Candidate, Contest, MeasureCitationRef } from "./civic";
import type { CanonicalMeasure } from "./measure-sources/types";
import { SOURCE_TIER_RANK } from "./measure-sources/types";

function rank(citation: MeasureCitationRef | undefined): number {
  return (
    Object.entries(SOURCE_TIER_RANK).find(
      ([tier]) => tier === citation?.tier,
    )?.[1] ?? 0
  );
}

/** Keep a field and its citation together, including when cached enrichment loses. */
export function mergeCandidateEnrichment(
  candidate: Candidate,
  merged: CanonicalCandidate,
): void {
  let citations = candidate.citations ?? [];
  for (const field of [
    "biography",
    "statement",
    "statementSummary",
    "incumbent",
    "photoUrl",
    "candidateUrl",
    "email",
    "phone",
    "channels",
  ] as const) {
    const value = merged[field];
    if (
      value == null ||
      value === "" ||
      (Array.isArray(value) && !value.length)
    )
      continue;
    const incoming = merged.citations.find((c) => c.field === field);
    const existing = citations.find((c) => c.field === field);
    if (
      candidate[field] != null &&
      existing &&
      rank(incoming) <= rank(existing)
    )
      continue;
    Object.assign(candidate, { [field]: value });
    if (field === "statementSummary")
      candidate.statementSummaryIsAiGenerated =
        merged.statementSummaryIsAiGenerated;
    citations = citations.filter((c) => c.field !== field);
    if (incoming) citations.push(incoming);
  }
  candidate.citations = citations.length ? citations : undefined;
}

/** The legacy ballot text survives enrichment, so its provider citation must too. */
export function mergeMeasureCitations(
  contest: Contest,
  merged: CanonicalMeasure,
): MeasureCitationRef[] {
  const citations: MeasureCitationRef[] = merged.citations.filter(
    (c) => c.field !== "fullText" && c.field !== "referendumText",
  );
  if (contest.referendumText) {
    citations.push(
      ...(contest.citations ?? []).filter(
        (c) => c.field === "referendumText" || c.field === "fullText",
      ),
    );
  } else if (merged.fullText) {
    citations.push(
      ...merged.citations
        .filter((c) => c.field === "fullText")
        .map((c) => ({ ...c, field: "referendumText" })),
    );
  }
  return citations;
}
