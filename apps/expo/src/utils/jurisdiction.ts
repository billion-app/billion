export type ContentJurisdiction = "federal" | "ca";

export interface JurisdictionDefinition {
  id: ContentJurisdiction;
  name: string;
  body: string;
  session: string;
  description: string;
  code: "US" | "CA";
  icon: "globe" | "pin";
  subtitlePlace: string;
}

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
};

export function addressIsInCalifornia(address: string | null): boolean {
  return !!address && /(?:,|\s)(?:CA|California)(?:\s|,|\d|$)/i.test(address);
}
