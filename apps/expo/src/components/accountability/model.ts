/** Prototype contract. These IDs are local, never provider IDs or name matches. */
export interface ContestIdentity {
  electionId: string;
  districtId: string;
  officeId: string;
  contestId: string;
}
export interface Evidence {
  publisher: string;
  url: string;
  locator: string;
  published: string;
}
export interface ResultRecord {
  identity: ContestIdentity;
  stage: "missing" | "preliminary" | "projected" | "certified";
  disputed: boolean;
  candidateId?: string;
  evidence?: Evidence;
}
export interface OfficeEntry {
  identity: ContestIdentity;
  candidateId: string;
  personId: string;
  tookOffice: string;
  /** Exclusive end of the documented term, when known. */
  leftOffice?: string;
  evidence: Evidence;
}
export interface Priority {
  id: string;
  topic: string;
  candidateId: string;
  date: string;
  text: string;
  evidence: Evidence;
}
export interface ActionRecord {
  topic: string;
  personId: string;
  officeId: string;
  districtId: string;
  date: string;
  kind: "sponsorship" | "vote" | "decision";
  text: string;
  context: string;
  evidence: Evidence;
}
export function sameContest(a: ContestIdentity, b: ContestIdentity) {
  return (
    a.electionId === b.electionId &&
    a.districtId === b.districtId &&
    a.officeId === b.officeId &&
    a.contestId === b.contestId
  );
}
/** A result summary has its own evidence/identity gate, independent of term entry. */
export function confirmedResultCandidate(
  contest: ContestIdentity,
  candidates: readonly { id: string; name: string }[],
  result: ResultRecord,
) {
  if (
    !sameContest(contest, result.identity) ||
    result.disputed ||
    result.stage !== "certified" ||
    !result.evidence
  )
    return undefined;
  const matches = candidates.filter(
    (candidate) => candidate.id === result.candidateId,
  );
  return matches.length === 1 ? matches[0] : undefined;
}
export function resolveOfficeholder(
  contest: ContestIdentity,
  candidates: readonly { id: string; name: string }[],
  result: ResultRecord,
  entry?: OfficeEntry,
) {
  if (
    !sameContest(contest, result.identity) ||
    result.disputed ||
    result.stage !== "certified" ||
    !result.evidence ||
    !entry ||
    !sameContest(contest, entry.identity) ||
    result.candidateId !== entry.candidateId
  )
    return undefined;
  if (
    !validDate(entry.tookOffice) ||
    (entry.leftOffice &&
      (!validDate(entry.leftOffice) || entry.leftOffice <= entry.tookOffice))
  )
    return undefined;
  const matches = candidates.filter((item) => item.id === entry.candidateId);
  const candidate = matches.length === 1 ? matches[0] : undefined;
  return candidate ? { ...entry, name: candidate.name } : undefined;
}
export function actionsFor(
  entry: OfficeEntry,
  actions: readonly ActionRecord[],
) {
  return actions.filter(
    (action) =>
      action.personId === entry.personId &&
      action.officeId === entry.identity.officeId &&
      action.districtId === entry.identity.districtId &&
      validDate(action.date) &&
      action.date >= entry.tookOffice &&
      (!entry.leftOffice || action.date < entry.leftOffice),
  );
}
export const stageCopy = {
  missing: "Results unavailable. Missing data does not establish a winner.",
  preliminary:
    "Preliminary count. Votes can still change before certification.",
  projected:
    "Projection. A source has called the race; this is not official certification.",
  certified: "Certified results. Taking office requires separate evidence.",
};

function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
