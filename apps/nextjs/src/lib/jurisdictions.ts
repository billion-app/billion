/**
 * The jurisdictions web Browse can scope to, with the phone's display copy
 * (`apps/expo/src/utils/jurisdiction.ts`).
 *
 * Missouri is absent on purpose: the phone keeps it only so old installs can
 * still render a stored `mo`, and a new surface has no such installs.
 */
export const SCOPES = ["federal", "ca", "nc", "tx"] as const;

export type Scope = (typeof SCOPES)[number];

export interface JurisdictionInfo {
  name: string;
  body: string;
  code: string;
  description: string;
}

export const JURISDICTIONS: Record<Scope, JurisdictionInfo> = {
  federal: {
    name: "United States",
    body: "United States Congress",
    code: "US",
    description: "Congress, the President, the Supreme Court",
  },
  ca: {
    name: "California",
    body: "California State Legislature",
    code: "CA",
    description: "State Legislature · 2025–2026 regular session",
  },
  nc: {
    name: "North Carolina",
    body: "North Carolina General Assembly",
    code: "NC",
    description: "General Assembly · 2025–2026 regular session",
  },
  tx: {
    name: "Texas",
    body: "Texas Legislature",
    code: "TX",
    description: "State Legislature · 89th Legislature",
  },
};

/** Display body for any jurisdiction the API may return, including `mo`. */
export const STATE_BODIES: Record<string, string | undefined> = {
  ...Object.fromEntries(SCOPES.map((scope) => [scope, JURISDICTIONS[scope].body])),
  mo: "Missouri General Assembly",
};

export function isScope(value: unknown): value is Scope {
  return SCOPES.some((scope) => scope === value);
}

export function isStateScope(scope: string | undefined): boolean {
  return !!scope && scope !== "federal";
}
