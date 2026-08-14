import type { ContentJurisdiction } from "./content-jurisdiction";
import {
  isStateJurisdiction,
  STATE_JURISDICTIONS,
} from "./content-jurisdiction";

export interface BillSponsorIdentity {
  raw: string;
  name: string;
  initials: string;
  partyCode?: string;
  party?: string;
  state?: string;
  district?: string;
}

const PARTY_NAMES: Record<string, string> = {
  D: "Democratic",
  R: "Republican",
  I: "Independent",
  L: "Libertarian",
};

/** Parse the normalized sponsor label stored by the Congress.gov scraper. */
export function parseBillSponsor(
  raw: string,
  jurisdiction: ContentJurisdiction = "federal",
): BillSponsorIdentity {
  const value = raw.trim();
  const match = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(value);
  const name = (match?.[1] ?? value)
    .replace(/^(?:Rep(?:resentative)?|Sen(?:ator)?)\.?\s+/i, "")
    .trim();
  const [partyCode, region, ...districtParts] = (match?.[2] ?? "")
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);
  const isStateSponsor = jurisdiction !== "federal";
  const state = isStateSponsor ? undefined : region;
  const district = isStateSponsor
    ? [region, ...districtParts].filter(Boolean).join("-") || undefined
    : districtParts.length > 0
      ? districtParts.join("-")
      : undefined;
  const nameParts = name.split(/\s+/).filter(Boolean);
  const initials = [nameParts[0], nameParts.at(-1)]
    .filter(Boolean)
    .map((part) => part?.[0]?.toUpperCase())
    .join("");

  return {
    raw: value,
    name,
    initials,
    partyCode,
    party: partyCode ? (PARTY_NAMES[partyCode] ?? partyCode) : undefined,
    state,
    district,
  };
}

export function sponsorRole(
  chamber?: string | null,
  jurisdiction: ContentJurisdiction = "federal",
): string {
  if (isStateJurisdiction(jurisdiction)) {
    const state = STATE_JURISDICTIONS[jurisdiction];
    if (chamber?.toLowerCase() === "senate") {
      return `${state.name} State Senator`;
    }
    return jurisdiction === "ca"
      ? "California Assemblymember"
      : `${state.name} State Representative`;
  }
  return chamber?.toLowerCase() === "senate"
    ? "U.S. Senator"
    : "U.S. Representative";
}
