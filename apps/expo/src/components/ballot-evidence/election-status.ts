/** Labels describe supplied evidence; guide inclusion never proves ballot eligibility. */
export function candidateStatusLabel(
  status: string | undefined,
  inStatementGuide = false,
): string {
  if (status === "withdrewStillOnBallot")
    return "Withdrawn; name remains listed by the ballot source";
  if (status === "onBallot") return "Listed by the ballot source";
  if (inStatementGuide)
    return "Statement guide entry · ballot status unverified";
  return "Ballot status unknown";
}

export type ElectionCoverage =
  | "verified-complete"
  | "partial"
  | "statement-guide"
  | "unknown";

export function electionCoverageLabel(coverage: ElectionCoverage): string {
  switch (coverage) {
    case "verified-complete":
      return "Complete ballot verified against official records";
    case "partial":
      return "Partial provider data · other contests or candidates may be missing";
    case "statement-guide":
      return "Statement guide · includes statement submitters, not a complete ballot";
    case "unknown":
      return "Coverage unknown · missing data does not mean no election or race exists";
  }
}

/** A freshness deadline must come from the evidence owner, never a UI guess. */
export function freshnessLabel(
  evidence: { fetchedAt?: string; staleAfter?: string; conflicting?: boolean },
  now = Date.now(),
): string | undefined {
  if (evidence.conflicting)
    return "Sources disagree · confirm with your election office";
  if (!evidence.fetchedAt || !Number.isFinite(Date.parse(evidence.fetchedAt)))
    return "Retrieval date unavailable";
  if (
    evidence.staleAfter &&
    Number.isFinite(Date.parse(evidence.staleAfter)) &&
    now >= Date.parse(evidence.staleAfter)
  )
    return "Source retrieval is out of date · confirm with your election office";
  return undefined;
}
