/** UI projection only. #421 owns stored evidence, revisions and publication. */
export type ComparisonTopic =
  | "priorities"
  | "record"
  | "effects"
  | "questionnaire";
export const comparisonTopics: { id: ComparisonTopic; label: string }[] = [
  { id: "priorities", label: "Priorities" },
  { id: "record", label: "Record" },
  { id: "effects", label: "Mechanisms & tradeoffs" },
  { id: "questionnaire", label: "Questionnaire" },
];
export interface ComparisonSource {
  id: string;
  name: string;
  locator: string;
  url?: string;
  fixtureText?: string;
}
export interface ComparisonClaim {
  text: string;
  attribution:
    | "Candidate statement"
    | "Documented record"
    | "Billion analysis"
    | "Candidate questionnaire";
  sourceIds: string[];
}
export type ComparisonCell =
  | { status: "available"; claims: ComparisonClaim[] }
  | {
      status:
        | "missing-evidence"
        | "unavailable-analysis"
        | "unanswered-questionnaire";
    };
export interface ComparisonCandidate {
  id: string;
  name: string;
  identity: string;
  ballotStatus: "on-ballot" | "withdrawn-still-on-ballot";
  cells: Partial<Record<ComparisonTopic, ComparisonCell>>;
}
export interface RaceComparison {
  raceId: string;
  office: string;
  election: string;
  fixture: boolean;
  candidates: ComparisonCandidate[];
  sources: ComparisonSource[];
}
export const gapCopy = {
  "missing-evidence":
    "Evidence missing for this topic. This does not establish the candidate’s position or record.",
  "unavailable-analysis":
    "Reviewed analysis unavailable. No conclusion about this candidate can be drawn here.",
  "unanswered-questionnaire":
    "Questionnaire unanswered. This is separate from other evidence and does not establish a position.",
} as const;

function safeUrl(value?: string) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
/** Fail closed before rendering malformed claims, identities or source references. */
export function validateComparison(race: RaceComparison): string[] {
  const errors: string[] = [];
  if (!race.raceId.trim() || !race.office.trim() || !race.election.trim())
    errors.push("Race identity missing");
  const ids = new Set<string>();
  const sources = new Map<string, ComparisonSource>();
  for (const source of race.sources) {
    if (!source.id.trim() || sources.has(source.id))
      errors.push("Source identity invalid");
    if (
      !source.name.trim() ||
      !source.locator.trim() ||
      !(safeUrl(source.url) || (race.fixture && source.fixtureText?.trim()))
    )
      errors.push("Source evidence unavailable");
    sources.set(source.id, source);
  }
  for (const candidate of race.candidates) {
    if (
      !candidate.id.trim() ||
      ids.has(candidate.id) ||
      !candidate.name.trim() ||
      !candidate.identity.trim()
    )
      errors.push("Candidate identity invalid");
    ids.add(candidate.id);
    for (const topic of comparisonTopics) {
      const cell = candidate.cells[topic.id];
      if (cell?.status !== "available") continue;
      if (!cell.claims.length) errors.push("Available topic has no claims");
      for (const claim of cell.claims) {
        if (
          !claim.text.trim() ||
          !claim.sourceIds.length ||
          claim.sourceIds.some((id) => !sources.has(id))
        )
          errors.push("Claim evidence missing");
        if (
          topic.id === "questionnaire" &&
          claim.attribution !== "Candidate questionnaire"
        )
          errors.push("Questionnaire attribution invalid");
      }
    }
  }
  return errors;
}
export function comparisonRows(race: RaceComparison, topic: ComparisonTopic) {
  return race.candidates.map((candidate) => ({
    candidate,
    cell: candidate.cells[topic] ?? {
      status:
        topic === "effects"
          ? ("unavailable-analysis" as const)
          : ("missing-evidence" as const),
    },
  }));
}
