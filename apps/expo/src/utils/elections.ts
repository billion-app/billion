import type { Contest } from "@acme/api";

/**
 * Election classification + ballot-organization helpers.
 *
 * Google Civic's `Election` has no explicit type field, so we infer
 * primary/general/special/recall from its `name` (e.g. "California Statewide
 * Primary Election"). The inferred type drives the plain-language explainer in
 * the election hero.
 */

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
