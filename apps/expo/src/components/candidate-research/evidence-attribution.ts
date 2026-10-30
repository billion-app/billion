import type { CandidateBrief } from "@acme/validators";

export type ResearchEvidence = CandidateBrief["evidence"][number];
export function researchEvidenceAttribution(evidence: ResearchEvidence): {
  label:
    | "Original record"
    | "Reporting"
    | "Candidate statement"
    | "Campaign publication"
    | "Candidate-related material";
  unresolved: boolean;
  context: NonNullable<ResearchEvidence["attribution"]>["context"] | undefined;
} {
  const unresolved =
    evidence.origin === "candidate" &&
    evidence.attribution?.status === "unresolved";
  const label =
    evidence.origin === "primary_record"
      ? "Original record"
      : evidence.origin === "reporting"
        ? "Reporting"
        : evidence.attribution?.status === "official_candidate_statement"
          ? "Candidate statement"
          : unresolved
            ? "Campaign publication"
            : "Candidate-related material";
  return { label, unresolved, context: evidence.attribution?.context };
}
