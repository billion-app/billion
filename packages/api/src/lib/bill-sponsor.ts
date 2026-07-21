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
export function parseBillSponsor(raw: string): BillSponsorIdentity {
  const value = raw.trim();
  const match = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(value);
  const name = (match?.[1] ?? value)
    .replace(/^(?:Rep(?:resentative)?|Sen(?:ator)?)\.?\s+/i, "")
    .trim();
  const [partyCode, state, ...districtParts] = (match?.[2] ?? "")
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);
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
    district: districtParts.length > 0 ? districtParts.join("-") : undefined,
  };
}

export function sponsorRole(chamber?: string | null): string {
  return chamber?.toLowerCase() === "senate"
    ? "U.S. Senator"
    : "U.S. Representative";
}
