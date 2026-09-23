import { STATE_JURISDICTIONS } from "@acme/api/content-jurisdiction";

/**
 * The jurisdictions web Browse can scope to.
 *
 * Names, legislatures and session labels come from the API's own table
 * (`packages/api/src/lib/content-jurisdiction.ts`) — the same one that labels
 * each bill — so a new session or a renamed body changes in one place. Which
 * jurisdictions are *offered* is a client choice, as on the phone: Missouri
 * stays in the API for old app installs but is not browsable here.
 */
export const SCOPES = ["federal", "ca", "nc", "tx"] as const;

export type Scope = (typeof SCOPES)[number];

export interface JurisdictionInfo {
  name: string;
  body: string;
  code: string;
  description: string;
}

function state(key: Exclude<Scope, "federal">): JurisdictionInfo {
  const def = STATE_JURISDICTIONS[key];
  return {
    name: def.name,
    body: def.legislature,
    code: def.code,
    description: def.currentSessionLabel,
  };
}

export const JURISDICTIONS: Record<Scope, JurisdictionInfo> = {
  federal: {
    name: "United States",
    body: "United States Congress",
    code: "US",
    description: "Congress, the President, the Supreme Court",
  },
  ca: state("ca"),
  nc: state("nc"),
  tx: state("tx"),
};

/** The legislature for any state the API may return, including retired ones. */
export function stateLegislature(jurisdiction: string): string | undefined {
  return Object.hasOwn(STATE_JURISDICTIONS, jurisdiction)
    ? STATE_JURISDICTIONS[jurisdiction as keyof typeof STATE_JURISDICTIONS]
        .legislature
    : undefined;
}

export function isScope(value: unknown): value is Scope {
  return SCOPES.some((scope) => scope === value);
}

export function isStateScope(scope: string | undefined): boolean {
  return !!scope && scope !== "federal";
}
