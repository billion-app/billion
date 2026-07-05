/**
 * San Francisco DataSF — Ballot Propositions DB adapter.
 *
 * Source: the San Francisco Public Library's historical ballot propositions database
 * cached in CivicApiCache by the sf-datasf scraper.
 *
 * Scope: California, San Francisco city/county ballot propositions.
 * Gates on stateAbbrev === "CA" and county === "San Francisco".
 */

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type { MeasureSourceData } from "./types";

const SOURCE_NAME = "San Francisco Ballot Propositions Database";
const CACHE_ADDRESS_HASH = "__global__";
const CACHE_ENDPOINT = "sf-datasf-propositions";

export interface SfProposition {
  propletter: string;
  proptitle: string;
  month: string;
  day: string;
  year: string;
  date: string;
  description: string;
  pass_fail: string;
  vote_counts_yes: string;
  vote_counts_no: string;
  percent_vote_yes: string;
  percent_vote_no: string;
  percent_required_to_pass: string;
  kind: string;
  howplaced: string;
  voter_information_pamphlet?: {
    url: string;
  };
}

export interface SfDataSfPayload {
  propositions: SfProposition[];
}

/** Parse proposition letter/number (e.g. "A" from "Proposition A" or "Measure A") */
export function parsePropositionLetterOrNumber(title: string): string | null {
  const m = /\b(?:proposition|prop\.?|measure)\s*#?\s*([0-9a-z]+)\b/i.exec(title);
  return m?.[1] ? m[1].toUpperCase() : null;
}

/**
 * Fetch and structure a San Francisco proposition from the cached DataSF dataset.
 */
export async function getSfDataSfProposition(
  referendumTitle: string,
  electionYear: number,
): Promise<MeasureSourceData | null> {
  try {
    const paramsStr = JSON.stringify({ year: electionYear });
    const [row] = await db
      .select()
      .from(CivicApiCache)
      .where(
        and(
          eq(CivicApiCache.addressHash, CACHE_ADDRESS_HASH),
          eq(CivicApiCache.endpoint, CACHE_ENDPOINT),
          eq(CivicApiCache.params, paramsStr),
        ),
      )
      .limit(1);

    if (!row) return null;

    const payload: Partial<SfDataSfPayload> = row.responseData as SfDataSfPayload;
    const propositions = Array.isArray(payload.propositions)
      ? payload.propositions
      : [];
    if (propositions.length === 0) return null;

    // Search for a matching proposition
    const targetLetter = parsePropositionLetterOrNumber(referendumTitle);
    const cleanedTitle = referendumTitle.trim().toLowerCase();

    let matchedProp: SfProposition | undefined;

    if (targetLetter) {
      matchedProp = propositions.find(
        (p) => p.propletter.toUpperCase() === targetLetter,
      );
    }

    matchedProp ??= propositions.find((p) => {
      const propTitle = p.proptitle ? p.proptitle.trim().toLowerCase() : "";
      if (!propTitle) return false;
      return cleanedTitle.includes(propTitle) || propTitle.includes(cleanedTitle);
    });

    if (!matchedProp) return null;

    const sourceUrl =
      matchedProp.voter_information_pamphlet?.url ?? "https://data.sfgov.org";

    const hasUsableDescription =
      matchedProp.description &&
      matchedProp.description.trim().length > 0 &&
      !/Not Included in Voter Handbook/i.test(matchedProp.description) &&
      !/Not Available in/i.test(matchedProp.description);

    const propletterLabel = matchedProp.propletter
      ? matchedProp.propletter.length === 1 && /[A-Z]/i.test(matchedProp.propletter)
        ? `Proposition ${matchedProp.propletter.toUpperCase()}`
        : `Proposition ${matchedProp.propletter}`
      : "Proposition";

    const matchedTitle = matchedProp.proptitle
      ? `${propletterLabel}: ${matchedProp.proptitle}`
      : propletterLabel;

    return {
      tier: "county_registrar", // High-trust official local source
      sourceName: SOURCE_NAME,
      sourceUrl,
      official: true,
      matchedTitle,
      officialSummary: hasUsableDescription ? matchedProp.description : undefined,
      fullTextUrl: matchedProp.voter_information_pamphlet?.url,
    };
  } catch {
    // Best-effort: return null on any DB/parsing error
    return null;
  }
}

/**
 * Entry point for the cross-validation engine.
 */
export async function enrichFromSfDataSf(
  referendumTitle: string,
  stateAbbrev: string | undefined,
  county: string | undefined,
  electionYear: number,
): Promise<MeasureSourceData | null> {
  if (stateAbbrev && stateAbbrev.toUpperCase() !== "CA") return null;
  // Check that the county is San Francisco
  if (county && !/san\s*francisco/i.test(county)) return null;

  return getSfDataSfProposition(referendumTitle, electionYear);
}
