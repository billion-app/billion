import type { Contest, Election, PollingLocation } from "@acme/api";

import type { AppLanguage } from "~/i18n/language";
import { translateApp } from "~/i18n/app-strings";
import { daysUntil } from "~/utils/dates";

/**
 * Ballot helpers: Civic election type from `name` and the CA filter.
 */

/** Civic always includes a dummy "VIP Test Election" with this id. */
const CIVIC_TEST_ELECTION_ID = "2000";

export type ElectionType =
  | "primary"
  | "general"
  | "special"
  | "recall"
  | "runoff"
  | "other";

/** Infer the election type from the Civic election name. */
export function electionType(name: string | undefined): ElectionType {
  const n = (name ?? "").toLowerCase();
  if (n.includes("recall")) return "recall";
  if (n.includes("runoff") || n.includes("run-off")) return "runoff";
  if (n.includes("special")) return "special";
  if (n.includes("primary")) return "primary";
  if (n.includes("general")) return "general";
  return "other";
}

/** Short badge label for an election type. */
export function electionTypeLabel(
  type: ElectionType,
  language: AppLanguage = "en",
): string {
  return translateApp(language, `elections.type.${type}`);
}

// ---------------------------------------------------------------------------
// Civic voter-info / elections list — only fields the backend actually returns
// ---------------------------------------------------------------------------

/**
 * Google Civic `normalizedInput.state` is usually the 2-letter code. Some
 * mocks and formatted addresses use the full name. Match both so the CA-only
 * product gate still works when this UI is pointed at the production API.
 */
export function isCaliforniaState(state: string | null | undefined): boolean {
  if (!state) return false;
  const s = state.trim().toLowerCase();
  return s === "ca" || s === "california";
}

/** Contest list title: Civic may omit `office` on some referendum-adjacent rows. */
export function contestListTitle(
  c: Contest,
  language: AppLanguage = "en",
): string {
  const office = c.office?.trim();
  if (office) return office;
  const ballot = c.ballotTitle?.trim();
  if (ballot) return ballot;
  return translateApp(language, "elections.contestFallback");
}

function isCivicTestElection(e: Election): boolean {
  return e.id === CIVIC_TEST_ELECTION_ID;
}

/** California or nationwide (presidential) elections from `civic.getElections`. */
export function isCaliforniaRelevantElection(e: Election): boolean {
  if (isCivicTestElection(e)) return false;
  const ocd = e.ocdDivisionId.toLowerCase();
  if (/\/state:ca(?:\/|$)/.test(ocd)) return true;
  if (/california/i.test(e.name)) return true;
  return ocd === "ocd-division/country:us";
}

/**
 * Next upcoming CA-relevant election from the nationwide Civic list.
 * Used only when there is no address yet — once `getVoterInfo` resolves, that
 * election wins. Never pick the soonest election in another state.
 */
export function pickUpcomingCaliforniaElection(
  elections: readonly Election[],
): Election | undefined {
  return [...elections]
    .filter(isCaliforniaRelevantElection)
    .filter((e) => daysUntil(e.electionDay) >= 0)
    .sort((a, b) => a.electionDay.localeCompare(b.electionDay))[0];
}

/** One-line polling subtitle from Civic locations — never a hardcoded site. */
export function pollingPlaceSubtitle(
  locations: readonly PollingLocation[] | undefined,
  mailOnly?: boolean,
  language: AppLanguage = "en",
): string | undefined {
  const loc = locations?.[0];
  if (loc) {
    const name = loc.name ?? loc.address.locationName;
    const city = loc.address.city;
    if (name && city) return `${name} · ${city}`;
    if (name) return name;
    const line = loc.address.line1;
    if (line && city) return `${line} · ${city}`;
    if (line) return line;
    if (city) return city;
  }
  if (mailOnly) return translateApp(language, "elections.mailBallot");
  return undefined;
}
