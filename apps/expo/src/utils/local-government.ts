/**
 * Which local government, if any, Billion actually covers for a reader.
 *
 * `legistar.getLocalBills` / `getMeetings` are wired to San Jose, Santa Clara
 * County, and Sunnyvale, and the router merges all three regardless of who is
 * asking. That means the content is real but frequently isn't *yours* — a
 * Sacramento reader sees San Jose council meetings.
 *
 * This resolves the reader's stored address against that coverage so the UI
 * can earn the word "your" instead of assuming it. Deliberately a string match
 * on the address: there is no address→jurisdiction service today, and a cheap
 * honest check beats an expensive wrong one. Broader coverage is issue #275;
 * a real resolver belongs with the local-government work in #282.
 */

/** The jurisdictions Legistar is wired for. Mirrors the tRPC router's enum. */
export const COVERED_JURISDICTIONS = [
  { id: "sanjose", name: "San Jose", match: /\bsan\s+jos[eé](?![a-z])/i },
  {
    id: "santaclara",
    name: "Santa Clara County",
    match: /\bsanta\s+clara\b/i,
  },
  { id: "sunnyvale", name: "Sunnyvale", match: /\bsunnyvale\b/i },
] as const;

export type CoveredJurisdictionId =
  (typeof COVERED_JURISDICTIONS)[number]["id"];

export interface CoveredJurisdiction {
  id: CoveredJurisdictionId;
  name: string;
}

/**
 * The covered jurisdiction containing this address, or `undefined`.
 *
 * `undefined` is the common case and is not an error — Bay-Area-only coverage
 * is intentional. Callers should say which governments they *do* cover rather
 * than apologising or hiding the section.
 */
export function coveredJurisdiction(
  address: string | null | undefined,
): CoveredJurisdiction | undefined {
  if (!address) return undefined;
  const found = COVERED_JURISDICTIONS.find((j) => j.match.test(address));
  return found ? { id: found.id, name: found.name } : undefined;
}

/** "San Jose, Santa Clara County, and Sunnyvale" — for coverage copy. */
export function coverageSummary(): string {
  const names = COVERED_JURISDICTIONS.map((j) => j.name);
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
