export const JURISDICTIONS = ["federal", "ca", "mo", "nc", "tx"] as const;

export type ContentJurisdiction = (typeof JURISDICTIONS)[number];
export type StateJurisdiction = Exclude<ContentJurisdiction, "federal">;

export const JURISDICTION_CODES = ["US", "CA", "MO", "NC", "TX"] as const;
export type JurisdictionCode = (typeof JURISDICTION_CODES)[number];

interface StateJurisdictionDefinition {
  code: Exclude<JurisdictionCode, "US">;
  name: string;
  legislature: string;
  lowerChamber: string;
  currentSession: string;
  currentSessionLabel: string;
}

export const STATE_JURISDICTIONS: Record<
  StateJurisdiction,
  StateJurisdictionDefinition
> = {
  ca: {
    code: "CA",
    name: "California",
    legislature: "California Legislature",
    lowerChamber: "Assembly",
    currentSession: "2025-2026",
    currentSessionLabel: "2025–2026 regular session",
  },
  // Kept for compatibility with installed app builds that can still send
  // `jurisdiction: "mo"`. Missouri is no longer scheduled or offered by the
  // current client, so these requests return an empty bill feed after cleanup
  // instead of failing input validation.
  mo: {
    code: "MO",
    name: "Missouri",
    legislature: "Missouri General Assembly",
    lowerChamber: "House",
    currentSession: "2026",
    currentSessionLabel: "2026 regular session",
  },
  nc: {
    code: "NC",
    name: "North Carolina",
    legislature: "North Carolina General Assembly",
    lowerChamber: "House",
    currentSession: "2025",
    currentSessionLabel: "2025–2026 regular session",
  },
  tx: {
    code: "TX",
    name: "Texas",
    legislature: "Texas Legislature",
    lowerChamber: "House",
    currentSession: "892",
    currentSessionLabel: "89th Legislature · 2nd called session",
  },
};

export interface StateBillIdentity {
  stateCode: string;
  identifier: string;
  sessionLabel: string;
}

export function isStateJurisdiction(
  jurisdiction: ContentJurisdiction,
): jurisdiction is StateJurisdiction {
  return jurisdiction !== "federal";
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
  return { stateCode, identifier, sessionLabel };
}

export function billJurisdiction(
  sourceWebsite: string,
  billNumber: string,
): ContentJurisdiction {
  if (sourceWebsite === "openstates.org") {
    const identity = parseStateBillNumber(billNumber);
    const jurisdiction = identity?.stateCode.toLowerCase();
    if (
      jurisdiction &&
      jurisdiction !== "federal" &&
      jurisdiction in STATE_JURISDICTIONS
    ) {
      return jurisdiction as StateJurisdiction;
    }
  }
  return "federal";
}

export function jurisdictionCode(
  jurisdiction: ContentJurisdiction,
): JurisdictionCode {
  return isStateJurisdiction(jurisdiction)
    ? STATE_JURISDICTIONS[jurisdiction].code
    : "US";
}

export function jurisdictionName(jurisdiction: ContentJurisdiction): string {
  return isStateJurisdiction(jurisdiction)
    ? STATE_JURISDICTIONS[jurisdiction].name
    : "United States";
}

export function officialSourceLabel(jurisdiction: ContentJurisdiction): string {
  return isStateJurisdiction(jurisdiction)
    ? STATE_JURISDICTIONS[jurisdiction].legislature
    : "congress.gov";
}

export function displaySessionLabel(
  jurisdiction: ContentJurisdiction,
  sourceSessionLabel: string | undefined,
): string | undefined {
  if (!isStateJurisdiction(jurisdiction)) return sourceSessionLabel;
  const definition = STATE_JURISDICTIONS[jurisdiction];
  return sourceSessionLabel === definition.currentSession
    ? definition.currentSessionLabel
    : sourceSessionLabel;
}
