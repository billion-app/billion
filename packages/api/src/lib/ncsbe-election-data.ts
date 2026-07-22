/** Provider-neutral reader for normalized NCSBE public election records. */
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import {
  ElectionCandidate,
  ElectionReferendum,
  ElectionResult,
  ElectionSource,
} from "@acme/db/schema";

export interface CivicContestReference {
  title: string;
  candidates?: string[];
}

export type ElectionMatch = {
  value: string;
  method: "exact" | "token";
  score: number;
} | null;

/**
 * Matching is exact after punctuation/case/party-suffix normalization. The
 * documented fallback is token Dice similarity >= .82, accepted only when the
 * best candidate is at least .08 ahead of the runner-up to avoid silent ties.
 */
export function matchNcsbeName(
  source: string,
  targets: readonly string[],
): ElectionMatch {
  const normalizedSource = normalize(source);
  const exact = targets.find(
    (target) => normalize(target) === normalizedSource,
  );
  if (exact) return { value: exact, method: "exact", score: 1 };
  const ranked = targets
    .map((target) => ({ target, score: dice(tokens(source), tokens(target)) }))
    .sort((a, b) => b.score - a.score || a.target.localeCompare(b.target));
  const best = ranked[0];
  const runnerUp = ranked[1];
  return best &&
    best.score >= 0.82 &&
    best.score - (runnerUp?.score ?? 0) >= 0.08
    ? { value: best.target, method: "token", score: best.score }
    : null;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\((?:dem|rep|lib|gre|una|non)\)\s*$/i, "")
    .replace(/\bnc\b/g, "north carolina")
    .replace(/\b(?:the|office of)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string): Set<string> {
  return new Set(normalize(value).split(" ").filter(Boolean));
}

function dice(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap++;
  return (2 * overlap) / (left.size + right.size);
}

function ensureCurrentCycle(electionDate: string, now: Date): void {
  const year = Number(electionDate.slice(0, 4));
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(electionDate) ||
    year !== now.getUTCFullYear()
  ) {
    throw new Error("NCSBE reads are limited to the current election cycle");
  }
}

function contestMatch(contest: string, refs: readonly CivicContestReference[]) {
  return matchNcsbeName(
    contest,
    refs.map((ref) => ref.title),
  );
}

export async function getCurrentNcElectionData(input: {
  county: string;
  electionDate: string;
  civicContests?: readonly CivicContestReference[];
  includePrecincts?: boolean;
  now?: Date;
}) {
  ensureCurrentCycle(input.electionDate, input.now ?? new Date());
  const county = input.county
    .trim()
    .replace(/\s+county$/i, "")
    .toUpperCase();
  const sourceFields = {
    sourceUrl: ElectionSource.sourceUrl,
    fetchedAt: ElectionSource.fetchedAt,
    checksum: ElectionSource.checksum,
    structureVersion: ElectionSource.structureVersion,
    certificationStatus: ElectionSource.certificationStatus,
  };

  const [candidateRows, referendumRows, resultRows] = await Promise.all([
    db
      .select({
        electionDate: ElectionCandidate.electionDate,
        county: ElectionCandidate.county,
        contest: ElectionCandidate.contest,
        name: ElectionCandidate.name,
        party: ElectionCandidate.party,
        voteFor: ElectionCandidate.voteFor,
        termYears: ElectionCandidate.termYears,
        hasPrimary: ElectionCandidate.hasPrimary,
        isPartisan: ElectionCandidate.isPartisan,
        ...sourceFields,
      })
      .from(ElectionCandidate)
      .innerJoin(
        ElectionSource,
        eq(ElectionCandidate.sourceId, ElectionSource.id),
      )
      .where(
        and(
          eq(ElectionCandidate.electionDate, input.electionDate),
          eq(ElectionCandidate.county, county),
        ),
      ),
    db
      .select({
        electionDate: ElectionReferendum.electionDate,
        county: ElectionReferendum.county,
        contest: ElectionReferendum.contest,
        choice: ElectionReferendum.choice,
        description: ElectionReferendum.description,
        ...sourceFields,
      })
      .from(ElectionReferendum)
      .innerJoin(
        ElectionSource,
        eq(ElectionReferendum.sourceId, ElectionSource.id),
      )
      .where(
        and(
          eq(ElectionReferendum.electionDate, input.electionDate),
          eq(ElectionReferendum.county, county),
        ),
      ),
    db
      .select({
        electionDate: ElectionResult.electionDate,
        county: ElectionResult.county,
        precinct: ElectionResult.precinct,
        contestId: ElectionResult.contestId,
        contestType: ElectionResult.contestType,
        contest: ElectionResult.contest,
        choice: ElectionResult.choice,
        party: ElectionResult.party,
        voteFor: ElectionResult.voteFor,
        electionDayVotes: ElectionResult.electionDayVotes,
        earlyVotingVotes: ElectionResult.earlyVotingVotes,
        absenteeMailVotes: ElectionResult.absenteeMailVotes,
        provisionalVotes: ElectionResult.provisionalVotes,
        totalVotes: ElectionResult.totalVotes,
        realPrecinct: ElectionResult.realPrecinct,
        ...sourceFields,
      })
      .from(ElectionResult)
      .innerJoin(ElectionSource, eq(ElectionResult.sourceId, ElectionSource.id))
      .where(
        and(
          eq(ElectionResult.electionDate, input.electionDate),
          eq(ElectionResult.county, county),
        ),
      ),
  ]);

  const refs = input.civicContests ?? [];
  const withContestMatch = <T extends { contest: string }>(
    rows: T[],
  ): (T & { civicMatch: ElectionMatch })[] => {
    const matched: (T & { civicMatch: ElectionMatch })[] = [];
    for (const row of rows) {
      if (refs.length === 0) {
        matched.push({ ...row, civicMatch: null });
        continue;
      }
      const civicMatch = contestMatch(row.contest, refs);
      if (civicMatch) matched.push({ ...row, civicMatch });
    }
    return matched;
  };
  const candidates = withContestMatch(candidateRows).map((row) => {
    const ref = refs.find(
      (candidate) => candidate.title === row.civicMatch?.value,
    );
    return {
      ...row,
      civicCandidateMatch: ref?.candidates?.length
        ? matchNcsbeName(row.name, ref.candidates)
        : null,
    };
  });
  const referenda = withContestMatch(referendumRows);
  const precinctResults = withContestMatch(resultRows);
  const totals = new Map<
    string,
    Omit<(typeof precinctResults)[number], "precinct" | "realPrecinct">
  >();
  for (const row of precinctResults) {
    const key = `${row.contest}\u0000${row.choice}\u0000${row.party ?? ""}`;
    const existing = totals.get(key);
    if (existing) {
      existing.electionDayVotes += row.electionDayVotes;
      existing.earlyVotingVotes += row.earlyVotingVotes;
      existing.absenteeMailVotes += row.absenteeMailVotes;
      existing.provisionalVotes += row.provisionalVotes;
      existing.totalVotes += row.totalVotes;
    } else {
      const {
        precinct: _precinct,
        realPrecinct: _realPrecinct,
        ...total
      } = row;
      totals.set(key, total);
    }
  }
  return {
    provider: "ncsbe" as const,
    electionDate: input.electionDate,
    county,
    candidates,
    referenda,
    results: [...totals.values()],
    precinctResults: input.includePrecincts ? precinctResults : undefined,
  };
}
