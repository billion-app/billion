import { z } from "zod";

import type { OfficialGuidePayload } from "./official-guide-cache";
import {
  freshSosReport,
  parseSosReportingTime,
  SOS_ELECTION_DATE,
  SOS_MEDIA,
  SOS_POLL_CLOSE,
  sosVoteCount,
  verifySosElection,
} from "../clients/ca-sos-provenance";

export type VoteStanding = "leading" | "tied" | "trailing" | "no-votes";
export interface ReportedVote {
  votes: number;
  share: number;
  standing: VoteStanding;
  rank: number;
  fieldSize: number;
}
interface ReportSource {
  sourceUrl: string;
  reportedAt: string;
  totalVotes: number;
  reportingLabel: string;
}
export type GuideCandidateResult = ReportedVote & ReportSource;
export type GuideMeasureResult = ReportSource & {
  yes: ReportedVote;
  no: ReportedVote;
};
export type CaliforniaGuideResults = {
  electionDate: string;
  sourceUrl: string;
} & (
  | { status: "pending" | "unavailable" }
  | {
      status: "reported";
      candidates: Record<string, GuideCandidateResult>;
      measures: Record<string, GuideMeasureResult>;
    }
);

const OFFICE = {
  governor: ["governor", "Governor"],
  "lt-governor": ["lieutenant-governor", "Lieutenant Governor"],
  sos: ["secretary-of-state", "Secretary of State"],
  controller: ["controller", "Controller"],
  treasurer: ["treasurer", "Treasurer"],
  "attorney-general": ["attorney-general", "Attorney General"],
  "insurance-commissioner": [
    "insurance-commissioner",
    "Insurance Commissioner",
  ],
  superintendent: [
    "superintendent-of-public-instruction",
    "Superintendent of Public Instruction",
  ],
} as const;
const rawContest = z.object({
  raceTitle: z.string(),
  ReportingTime: z.string(),
  Reporting: z.string().optional(),
  candidates: z
    .array(z.object({ Name: z.string().min(1), Votes: z.string() }))
    .optional(),
  "ballot-measures": z
    .array(
      z.object({
        Name: z.string(),
        Number: z.string(),
        yesVotes: z.string(),
        noVotes: z.string(),
      }),
    )
    .optional(),
});
const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const numberKey = (value: string) => value.replace(/^0+(?=\d)/, "");
export const guideCandidateResultKey = (office: string, name: string) =>
  `${office}:${name}`;

function vote(votes: number, counts: number[]): ReportedVote {
  const total = counts.reduce((sum, count) => sum + count, 0);
  const maximum = Math.max(...counts);
  return {
    rank: counts.filter((count) => count > votes).length + 1,
    fieldSize: counts.length,
    votes,
    share: total ? (votes / total) * 100 : 0,
    standing: !total
      ? "no-votes"
      : votes < maximum
        ? "trailing"
        : counts.filter((count) => count === maximum).length > 1
          ? "tied"
          : "leading",
  };
}

export async function loadCaliforniaGuideResults(
  guide: OfficialGuidePayload | null,
  options: { fetcher?: typeof fetch; now?: number } = {},
): Promise<CaliforniaGuideResults> {
  const now = options.now ?? Date.now();
  const fetcher = options.fetcher ?? fetch;
  const base = {
    electionDate: guide?.electionDate ?? SOS_ELECTION_DATE,
    sourceUrl: "https://electionresults.sos.ca.gov/",
  };
  if (guide?.electionDate !== SOS_ELECTION_DATE)
    return { ...base, status: "unavailable" };
  if (now < SOS_POLL_CLOSE) return { ...base, status: "pending" };
  try {
    if (!(await verifySosElection(fetcher, now)))
      return { ...base, status: "unavailable" };
    const read = async (file: string) => {
      try {
        const response = await fetcher(`${SOS_MEDIA}/${file}.json`, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) return [];
        const parsed = z.array(rawContest).safeParse(await response.json());
        return parsed.success ? parsed.data : [];
      } catch {
        return [];
      }
    };
    const candidates: Record<string, GuideCandidateResult> = {};
    const measures: Record<string, GuideMeasureResult> = {};
    await Promise.all(
      [
        ...new Set(guide.candidates.map((candidate) => candidate.officeSlug)),
      ].map(async (slug) => {
        const [file, title] = OFFICE[slug];
        const contests = (await read(file)).filter(
          (contest) => contest.raceTitle === `${title} - Statewide Results`,
        );
        if (
          contests.length !== 1 ||
          !freshSosReport(contests[0]?.ReportingTime, now)
        )
          return;
        const contest = contests[0];
        if (!contest) return;
        const timestamp = parseSosReportingTime(contest.ReportingTime);
        if (timestamp === null) return;
        const roster = contest.candidates;
        if (!roster?.length) return;
        const names = roster.map((candidate) => normalize(candidate.Name));
        const counts = roster.map((candidate) => sosVoteCount(candidate.Votes));
        if (
          names.some((name) => !name) ||
          new Set(names).size !== names.length ||
          counts.some((count) => count === null)
        )
          return;
        const votes = counts as number[];
        const totalVotes = votes.reduce((sum, count) => sum + count, 0);
        if (!Number.isSafeInteger(totalVotes)) return;
        for (const candidate of guide.candidates.filter(
          (candidate) => candidate.officeSlug === slug,
        )) {
          const index = names.indexOf(normalize(candidate.name));
          const count = votes[index];
          if (count === undefined) continue;
          candidates[guideCandidateResultKey(slug, candidate.name)] = {
            ...vote(count, votes),
            totalVotes,
            reportingLabel: contest.Reporting ?? "",
            reportedAt: new Date(timestamp).toISOString(),
            sourceUrl: base.sourceUrl,
          };
        }
      }),
    );
    const statewide = (await read("ballot-measures")).filter(
      (contest) => contest.raceTitle === "Ballot Measures - Statewide Results",
    );
    const entries = statewide.flatMap((contest) =>
      (contest["ballot-measures"] ?? []).map((measure) => ({
        measure,
        contest,
      })),
    );
    for (const official of guide.measures) {
      const matches = entries.filter(
        ({ measure }) =>
          numberKey(measure.Number) === numberKey(official.number),
      );
      if (matches.length !== 1) continue;
      const matched = matches[0];
      if (!matched) continue;
      const { measure, contest } = matched;
      const timestamp = parseSosReportingTime(contest.ReportingTime);
      if (timestamp === null) continue;
      if (!freshSosReport(contest.ReportingTime, now)) continue;
      if (normalize(measure.Name) !== normalize(official.title)) continue;
      const yes = sosVoteCount(measure.yesVotes);
      const no = sosVoteCount(measure.noVotes);
      if (yes === null || no === null || !Number.isSafeInteger(yes + no))
        continue;
      measures[official.number] = {
        yes: vote(yes, [yes, no]),
        no: vote(no, [yes, no]),
        totalVotes: yes + no,
        reportingLabel: contest.Reporting ?? "",
        reportedAt: new Date(timestamp).toISOString(),
        sourceUrl: base.sourceUrl,
      };
    }
    return Object.keys(candidates).length || Object.keys(measures).length
      ? { ...base, status: "reported", candidates, measures }
      : { ...base, status: "unavailable" };
  } catch {
    return { ...base, status: "unavailable" };
  }
}
