/** Current-cycle Texas SOS facts and TLC explanations for Google Civic measures. */

import type { TexasCurrentElectionData } from "../texas-election-data";
import type { MeasureSourceData } from "./types";
import { getTexasCurrentElectionData } from "../texas-election-data";
import { titleSimilarity } from "../votesmart";

function propositionNumber(title: string): number | undefined {
  const value = /\b(?:proposition|prop\.?)\s*(\d+)\b/i.exec(title)?.[1];
  return value ? Number.parseInt(value, 10) : undefined;
}

function sameDate(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return true;
  const left = new Date(a);
  const right = new Date(b);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

/**
 * Match by election date/year plus proposition number, falling back to a title
 * similarity check only when Google omits the number. The returned SOS and TLC
 * source objects stay separate so field citations cannot collapse them.
 */
export async function enrichFromTexasOfficial(
  title: string,
  context: {
    stateAbbrev?: string;
    electionYear: number;
    electionDate?: string;
  },
): Promise<{ sos?: MeasureSourceData; tlc?: MeasureSourceData }> {
  if (context.stateAbbrev?.toUpperCase() !== "TX") return {};
  const current = await getTexasCurrentElectionData().catch(() => null);
  return matchTexasOfficialMeasure(title, context, current);
}

/** Pure matcher used by the reader and fixture tests. */
export function matchTexasOfficialMeasure(
  title: string,
  context: {
    stateAbbrev?: string;
    electionYear: number;
    electionDate?: string;
  },
  current: TexasCurrentElectionData | null,
): { sos?: MeasureSourceData; tlc?: MeasureSourceData } {
  if (context.stateAbbrev?.toUpperCase() !== "TX") return {};
  const amendments = current?.constitutionalAmendments;
  if (
    amendments?.cycleYear !== context.electionYear ||
    !sameDate(context.electionDate, amendments.electionDate)
  ) {
    return {};
  }

  const number = propositionNumber(title);
  const measure = amendments.measures.find((candidate) => {
    if (number !== undefined) return candidate.propositionNumber === number;
    return titleSimilarity(title, candidate.ballotLanguage ?? "") >= 0.45;
  });
  if (!measure) return {};

  const tlc: MeasureSourceData = {
    tier: "legislative_council",
    sourceName: "Texas Legislative Council",
    sourceUrl: measure.citations.summaryAnalysis?.sourceUrl,
    official: true,
    matchedTitle: measure.ballotLanguage,
    officialSummary: measure.summaryAnalysis,
    fiscalImpact: measure.fiscalImplications.join(" ") || undefined,
    fullText: measure.ballotLanguage,
    fullTextUrl: measure.citations.ballotLanguage?.sourceUrl,
    proArguments: measure.supporterArguments.map((text) => ({
      text,
      sourceName: "Texas Legislative Council",
      sourceUrl: measure.citations.supporterArguments?.sourceUrl,
    })),
    conArguments: measure.opponentArguments.map((text) => ({
      text,
      sourceName: "Texas Legislative Council",
      sourceUrl: measure.citations.opponentArguments?.sourceUrl,
    })),
  };

  const result = measure.result;
  const sos: MeasureSourceData | undefined = result
    ? {
        tier: "state_sos",
        sourceName: "Texas Secretary of State",
        sourceUrl: result.citation.sourceUrl,
        official: true,
        matchedTitle: title,
        result: {
          status: result.status,
          outcome: result.outcome,
          totalVotes: result.totalVotes,
          choices: result.choices.map((choice) => ({
            name: choice.name,
            votes: choice.votes,
            percent: choice.percent,
          })),
          sourceName: "Texas Secretary of State",
          sourceUrl: result.citation.sourceUrl,
          asOf: result.asOf,
        },
      }
    : undefined;
  return { sos, tlc };
}
