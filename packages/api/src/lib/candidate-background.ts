/**
 * Biography for one candidate page.
 *
 * This is the same cache and merge as ballot enrichment (`candidate-enrich` via
 * `getCachedCandidate` / `crossValidateCandidate`). Every named candidate uses
 * that path: Open States, Vote Smart, Ballotpedia, Wikipedia, and the official
 * statement adapters. A hit returns the cited biography already chosen by trust
 * tier. A miss computes the full record and stores it, so the next ballot view
 * of the same person does not fetch again. Nothing here writes a second cache
 * or authors prose from the name.
 */

import type { CanonicalCandidate } from "./candidate-sources/types";
import { getCachedCandidate, setCachedCandidate } from "./candidate-cache";
import { crossValidateCandidate } from "./candidate-crossvalidate";

export interface CandidateBackground {
  biography: string;
  sourceName: string;
  sourceUrl?: string;
  tier: string;
  official: boolean;
}

/** The biography field and its citation, or nothing when the merge had no prose. */
export function biographyFromCanonical(
  record: CanonicalCandidate,
): CandidateBackground | null {
  if (!record.biography?.trim()) return null;
  const citation = record.citations.find((item) => item.field === "biography");
  if (!citation) return null;
  return {
    biography: record.biography.trim(),
    sourceName: citation.sourceName,
    sourceUrl: citation.sourceUrl,
    tier: citation.tier,
    official: citation.official,
  };
}

export async function getCandidateBackground(input: {
  name: string;
  office: string;
  electionYear: number;
  stateAbbrev?: string;
  district?: string;
  county?: string;
  party?: string;
  roles?: string[];
  level?: string[];
}): Promise<CandidateBackground | null> {
  const cached = await getCachedCandidate(
    input.name,
    input.office,
    input.electionYear,
    input.stateAbbrev,
    input.district,
    input.county,
  );
  if (cached) return biographyFromCanonical(cached);

  const merged = await crossValidateCandidate(
    {
      name: input.name,
      party: input.party,
      office: input.office,
      district: input.district,
      roles: input.roles,
      level: input.level,
    },
    {
      stateAbbrev: input.stateAbbrev,
      county: input.county,
      electionYear: input.electionYear,
    },
  );
  await setCachedCandidate(
    input.name,
    input.office,
    input.electionYear,
    merged,
    input.stateAbbrev,
    input.district,
    input.county,
  );
  return biographyFromCanonical(merged);
}
