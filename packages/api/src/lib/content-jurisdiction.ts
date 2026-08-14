export const JURISDICTIONS = ["federal", "ca"] as const;

export type ContentJurisdiction = (typeof JURISDICTIONS)[number];

export interface StateBillIdentity {
  stateCode: string;
  identifier: string;
  sessionLabel: string;
}

/** Recover the display identity embedded by the Open States scraper. */
export function parseStateBillNumber(
  billNumber: string,
): StateBillIdentity | undefined {
  const match = /^([A-Z]{2})\s+([A-Z]+\s\d+[A-Z]?)\s+\((.+)\)$/.exec(
    billNumber.trim(),
  );
  if (!match) return undefined;
  const [, stateCode, identifier, sessionLabel] = match;
  if (!stateCode || !identifier || !sessionLabel) return undefined;
  return {
    stateCode,
    identifier,
    sessionLabel,
  };
}

export function billJurisdiction(
  sourceWebsite: string,
  billNumber: string,
): ContentJurisdiction {
  if (sourceWebsite === "openstates.org") {
    const identity = parseStateBillNumber(billNumber);
    if (identity?.stateCode === "CA") return "ca";
  }
  return "federal";
}

export function jurisdictionCode(
  jurisdiction: ContentJurisdiction,
): "US" | "CA" {
  return jurisdiction === "ca" ? "CA" : "US";
}

export function officialSourceLabel(jurisdiction: ContentJurisdiction): string {
  return jurisdiction === "ca" ? "California Legislature" : "congress.gov";
}
