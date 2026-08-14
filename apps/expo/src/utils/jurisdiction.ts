export const CONTENT_JURISDICTIONS = [
  "federal",
  "ca",
  "mo",
  "nc",
  "tx",
] as const;

export type ContentJurisdiction = (typeof CONTENT_JURISDICTIONS)[number];
export type StateJurisdiction = Exclude<ContentJurisdiction, "federal">;
export type JurisdictionCode = "US" | "CA" | "MO" | "NC" | "TX";

export interface JurisdictionDefinition {
  id: ContentJurisdiction;
  name: string;
  body: string;
  session: string;
  description: string;
  code: JurisdictionCode;
  icon: "globe" | "pin";
  subtitlePlace: string;
}

export const STATE_JURISDICTIONS: StateJurisdiction[] = [
  "ca",
  "mo",
  "nc",
  "tx",
];

export const JURISDICTIONS: Record<
  ContentJurisdiction,
  JurisdictionDefinition
> = {
  federal: {
    id: "federal",
    name: "United States",
    body: "United States Congress",
    session: "119th Congress",
    description: "Congress, the President, the Supreme Court",
    code: "US",
    icon: "globe",
    subtitlePlace: "your government",
  },
  ca: {
    id: "ca",
    name: "California",
    body: "California State Legislature",
    session: "2025–2026 regular session",
    description: "State Legislature · 2025–2026 regular session",
    code: "CA",
    icon: "pin",
    subtitlePlace: "Sacramento",
  },
  mo: {
    id: "mo",
    name: "Missouri",
    body: "Missouri General Assembly",
    session: "2026 regular session",
    description: "General Assembly · 2026 regular session",
    code: "MO",
    icon: "pin",
    subtitlePlace: "Jefferson City",
  },
  nc: {
    id: "nc",
    name: "North Carolina",
    body: "North Carolina General Assembly",
    session: "2025–2026 regular session",
    description: "General Assembly · 2025–2026 regular session",
    code: "NC",
    icon: "pin",
    subtitlePlace: "Raleigh",
  },
  tx: {
    id: "tx",
    name: "Texas",
    body: "Texas Legislature",
    session: "89th Legislature · 2nd called session",
    description: "State Legislature · 89th Legislature",
    code: "TX",
    icon: "pin",
    subtitlePlace: "Austin",
  },
};

const ADDRESS_PATTERNS: Record<StateJurisdiction, RegExp> = {
  ca: /(?:,|\s)(?:CA|California)(?:\s|,|\d|$)/i,
  mo: /(?:,|\s)(?:MO|Missouri)(?:\s|,|\d|$)/i,
  nc: /(?:,|\s)(?:NC|North Carolina)(?:\s|,|\d|$)/i,
  tx: /(?:,|\s)(?:TX|Texas)(?:\s|,|\d|$)/i,
};

export function isContentJurisdiction(
  value: string | null,
): value is ContentJurisdiction {
  return CONTENT_JURISDICTIONS.some((jurisdiction) => jurisdiction === value);
}

export function isStateJurisdiction(
  jurisdiction: ContentJurisdiction | undefined,
): jurisdiction is StateJurisdiction {
  return !!jurisdiction && jurisdiction !== "federal";
}

export function jurisdictionFromAddress(
  address: string | null,
): StateJurisdiction | undefined {
  if (!address) return undefined;
  return STATE_JURISDICTIONS.find((jurisdiction) =>
    ADDRESS_PATTERNS[jurisdiction].test(address),
  );
}
