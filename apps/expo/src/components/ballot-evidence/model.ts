/** UI evidence only. An empty provider response is not proof of publication status. */
export type BallotEvidence =
  | { kind: "invalid-input" }
  | { kind: "provider-failure" }
  | { kind: "result"; electionKnown: boolean; contestCount: number };

export function ballotStatus(evidence: BallotEvidence) {
  if (evidence.kind === "invalid-input")
    return {
      title: "Check your address",
      detail: "Enter a complete address and try again.",
    };
  if (evidence.kind === "provider-failure")
    return {
      title: "Ballot lookup failed",
      detail:
        "Billion could not reach ballot information. Try again or check with your election office.",
    };
  if (evidence.contestCount > 0)
    return {
      title: "Ballot data available",
      detail:
        "These are the contests returned for this lookup. Confirm your complete ballot with your election office.",
    };
  if (evidence.electionKnown)
    return {
      title: "Election found; ballot unavailable",
      detail:
        "Billion found an election but has no ballot contests for this lookup. This does not establish whether the official ballot has been published.",
    };
  return {
    title: "No ballot data found",
    detail:
      "Billion found no ballot data for this lookup. This does not mean there is no election.",
  };
}

/** Structurally accepts existing measure citations; adapters retain candidate field names. */
export interface BallotCitation {
  field: string;
  sourceName: string;
  sourceUrl?: string;
  official?: boolean;
  fetchedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export function webUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function verificationLabel(citation: BallotCitation): string {
  if (
    !citation.verifiedAt ||
    !citation.verifiedBy ||
    !Number.isFinite(Date.parse(citation.verifiedAt))
  )
    return "Verification date unavailable";
  return `Last verified ${citation.verifiedAt} by ${citation.verifiedBy}`;
}

export interface LanguageEvidence {
  language: string;
  material: string;
  citation: BallotCitation;
}

export function verifiedLanguages(items: readonly LanguageEvidence[]) {
  return items.filter(
    ({ language, material, citation }) =>
      language.trim() &&
      material.trim() &&
      citation.official === true &&
      webUrl(citation.sourceUrl) &&
      citation.verifiedAt &&
      citation.verifiedBy &&
      Number.isFinite(Date.parse(citation.verifiedAt)),
  );
}
