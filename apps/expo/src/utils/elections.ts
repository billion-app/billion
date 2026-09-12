import type { Contest, Election, PollingLocation } from "@acme/api";

import { daysUntil } from "~/utils/dates";

/**
 * Ballot helpers: Civic election type from `name`, contest grouping, CA filter.
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
export function electionTypeLabel(type: ElectionType): string {
  switch (type) {
    case "primary":
      return "Primary";
    case "general":
      return "General";
    case "special":
      return "Special";
    case "recall":
      return "Recall";
    case "runoff":
      return "Runoff";
    default:
      return "Election";
  }
}

/**
 * One plain-language sentence explaining what this kind of election decides.
 * Static copy — no backend. Keeps the "what does this mean" promise of the hero.
 */
export function electionExplainer(type: ElectionType): string {
  switch (type) {
    case "primary":
      return "A primary narrows the field. In California's top-two system, the two highest vote-getters for each office advance to the November general — regardless of party.";
    case "general":
      return "The general election decides who takes office. Winners are seated and approved measures become law.";
    case "special":
      return "A special election is held off the normal cycle to fill a vacancy or settle a single urgent question.";
    case "recall":
      return "A recall lets voters decide whether to remove an official from office before their term ends.";
    case "runoff":
      return "A runoff is a second round between the top finishers when no candidate won outright in the first round.";
    default:
      return "Review the contests and measures below to see everything on your ballot.";
  }
}

// ---------------------------------------------------------------------------
// Candidate contests grouped by government level
// ---------------------------------------------------------------------------

export type LevelGroupKey = "federal" | "state" | "county" | "local";

export interface LevelGroup {
  key: LevelGroupKey;
  label: string;
  contests: Contest[];
}

const LEVEL_GROUP_ORDER: { key: LevelGroupKey; label: string }[] = [
  { key: "federal", label: "Federal" },
  { key: "state", label: "State" },
  { key: "county", label: "County" },
  { key: "local", label: "Local / Judicial" },
];

/** Map a single Civic `level` value onto one of our four display groups. */
function levelToGroup(level: string | undefined): LevelGroupKey {
  switch (level) {
    case "country":
      return "federal";
    case "administrativeArea1":
      return "state";
    case "administrativeArea2":
      return "county";
    default:
      // locality, subLocality1/2, special, regional, or missing → local.
      return "local";
  }
}

/** True when a contest is judicial (always sorted into Local / Judicial). */
function isJudicial(c: Contest): boolean {
  return (c.roles ?? []).some(
    (r) => r === "judge" || r === "highestCourtJudge",
  );
}

/**
 * Bucket candidate contests into Federal → State → County → Local/Judicial,
 * preserving ballot order within each group and dropping empty groups.
 */
export function groupContestsByLevel(contests: Contest[]): LevelGroup[] {
  const buckets: Record<LevelGroupKey, Contest[]> = {
    federal: [],
    state: [],
    county: [],
    local: [],
  };
  for (const c of contests) {
    const key = isJudicial(c) ? "local" : levelToGroup(c.level?.[0]);
    buckets[key].push(c);
  }
  return LEVEL_GROUP_ORDER.filter((g) => buckets[g.key].length > 0).map(
    (g) => ({ ...g, contests: buckets[g.key] }),
  );
}

// ---------------------------------------------------------------------------
// Measures: statewide propositions vs local measures
// ---------------------------------------------------------------------------

/**
 * Classify a measure as statewide (numbered "Proposition") vs local (lettered
 * "Measure"). Heuristic on the title since Civic doesn't tag this directly.
 */
export function measureIsStatewide(m: Contest): boolean {
  const t = (m.referendumTitle ?? "").toLowerCase();
  if (t.includes("proposition")) return true;
  // ACA / SCA — statewide legislative constitutional amendments.
  if (/\b(aca|sca)\b/.test(t)) return true;
  return false;
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
export function contestListTitle(c: Contest): string {
  const office = c.office?.trim();
  if (office) return office;
  const ballot = c.ballotTitle?.trim();
  if (ballot) return ballot;
  return "Contest";
}

function isCivicTestElection(e: Election): boolean {
  return e.id === CIVIC_TEST_ELECTION_ID;
}

/** California or nationwide (presidential) elections from `civic.getElections`. */
export function isCaliforniaRelevantElection(e: Election): boolean {
  if (isCivicTestElection(e)) return false;
  const ocd = (e.ocdDivisionId ?? "").toLowerCase();
  if (/\/state:ca(?:\/|$)/.test(ocd)) return true;
  if (/california/i.test(e.name ?? "")) return true;
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

/** Earliest Civic early-vote startDate, if the voterinfo payload included any. */
export function earliestEarlyVoteStart(
  sites: readonly PollingLocation[] | undefined,
): string | undefined {
  const dates = (sites ?? [])
    .map((s) => s.startDate)
    .filter((d): d is string => !!d);
  if (dates.length === 0) return undefined;
  return [...dates].sort()[0];
}

/** One-line polling subtitle from Civic locations — never a hardcoded site. */
export function pollingPlaceSubtitle(
  locations: readonly PollingLocation[] | undefined,
  mailOnly?: boolean,
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
  if (mailOnly) return "Mail ballot";
  return undefined;
}
