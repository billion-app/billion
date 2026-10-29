import type {
  CaliforniaGuideResults,
  GuideCandidateResult,
  GuideMeasureResult,
} from "./california-guide-results";
import type { ContestPoll, PollingObservation } from "./california-polling";
import type { OfficialGuidePayload } from "./official-guide-cache";
import { guideCandidateResultKey } from "./california-guide-results";
import {
  californiaPollingReportSchema,
  pollingName,
  publicContestPoll,
} from "./california-polling";
import { CA_GENERAL_ELECTION_DATE } from "./official-guide-cache";

interface Absent {
  kind: "none";
}
interface Poll {
  kind: "poll";
  poll: ContestPoll;
}
export type CandidateStanding =
  | Absent
  | { kind: "official"; result: GuideCandidateResult };
export type MeasureStanding =
  | Absent
  | Poll
  | { kind: "official"; result: GuideMeasureResult };
export type GovernorStanding =
  | Absent
  | Poll
  | {
      kind: "official";
      candidates: { name: string; result: GuideCandidateResult }[];
    };
export interface CaliforniaGuideStandings {
  electionDate: string;
  candidates: Record<string, CandidateStanding>;
  measures: Record<string, MeasureStanding>;
  governor: GovernorStanding;
}
const GOVERNOR_NAMES = ["Xavier Becerra", "Steve Hilton"].map(pollingName);
function sameNames(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    [...left].sort().every((name, index) => name === [...right].sort()[index])
  );
}
export function selectCaliforniaGuideStandings(
  guide: OfficialGuidePayload | null,
  official: CaliforniaGuideResults,
  cachedReports: unknown[],
  now = Date.now(),
): CaliforniaGuideStandings {
  const snapshot: CaliforniaGuideStandings = {
    electionDate: CA_GENERAL_ELECTION_DATE,
    governor: { kind: "none" },
    candidates: {},
    measures: {},
  };
  if (guide?.electionDate !== CA_GENERAL_ELECTION_DATE) return snapshot;
  const today = new Date(now).toISOString().slice(0, 10);
  const reports = cachedReports
    .flatMap((value) => {
      const parsed = californiaPollingReportSchema.safeParse(value);
      if (!parsed.success) return [];
      const report = parsed.data;
      return report.electionDate === guide.electionDate &&
        report.fieldEnd <= today &&
        Date.parse(report.retrievedAt) <= now &&
        (!report.publishedAt || report.publishedAt <= today)
        ? [report]
        : [];
    })
    .sort(
      (a, b) =>
        b.fieldEnd.localeCompare(a.fieldEnd) ||
        (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") ||
        `${a.publisher}:${a.reportId}`.localeCompare(
          `${b.publisher}:${b.reportId}`,
        ),
    );
  const latest = (
    matches: (observation: PollingObservation) => boolean,
  ): ContestPoll | null => {
    for (const report of reports) {
      const observations = report.observations.filter(matches);
      if (observations.length === 1 && observations[0])
        return publicContestPoll(report, observations[0]);
    }
    return null;
  };
  const result =
    official.electionDate === guide.electionDate &&
    official.status === "reported"
      ? official
      : null;
  for (const measure of guide.measures) {
    const counted = result?.measures[measure.number];
    const poll = latest(
      (observation) =>
        observation.contest.type === "measure" &&
        observation.contest.number === measure.number &&
        pollingName(observation.contest.officialTitle) ===
          pollingName(measure.title),
    );
    snapshot.measures[measure.number] =
      counted && counted.totalVotes > 0
        ? { kind: "official", result: counted }
        : poll
          ? { kind: "poll", poll }
          : { kind: "none" };
  }
  for (const candidate of guide.candidates) {
    const key = guideCandidateResultKey(candidate.officeSlug, candidate.name);
    const officeCounted =
      result &&
      Object.entries(result.candidates).some(
        ([entryKey, value]) =>
          entryKey.startsWith(`${candidate.officeSlug}:`) &&
          value.totalVotes > 0,
      );
    const counted = Object.entries(result?.candidates ?? {}).find(
      ([entryKey]) => {
        const separator = entryKey.indexOf(":");
        return (
          entryKey.slice(0, separator) === candidate.officeSlug &&
          pollingName(entryKey.slice(separator + 1)) ===
            pollingName(candidate.name)
        );
      },
    )?.[1];
    if (officeCounted) {
      snapshot.candidates[key] = counted
        ? { kind: "official", result: counted }
        : { kind: "none" };
      continue;
    }
    snapshot.candidates[key] = { kind: "none" };
  }
  const governorResults = Object.entries(result?.candidates ?? {})
    .filter(
      ([key, value]) => key.startsWith("governor:") && value.totalVotes > 0,
    )
    .map(([key, value]) => ({
      name: key.slice("governor:".length),
      result: value,
    }));
  const governorPoll = latest(
    (observation) =>
      observation.contest.type === "candidate" &&
      observation.contest.officeSlug === "governor" &&
      sameNames(
        observation.contest.candidateNames.map(pollingName),
        GOVERNOR_NAMES,
      ),
  );
  snapshot.governor = governorResults.length
    ? { kind: "official", candidates: governorResults }
    : governorPoll
      ? { kind: "poll", poll: governorPoll }
      : { kind: "none" };
  return snapshot;
}
