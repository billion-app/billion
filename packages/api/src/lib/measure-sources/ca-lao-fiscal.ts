/**
 * California Legislative Analyst's Office (LAO) fiscal analysis adapter.
 *
 * Source: https://lao.ca.gov/BallotAnalysis — the official nonpartisan fiscal
 * analysis of California statewide ballot propositions, published since 1996.
 *
 * Scope: California statewide propositions only, years 1996–present. The LAO
 * CMS URL pattern (/BallotAnalysis/Proposition?number=N&year=YYYY) returns
 * HTTP 500 for any combination not in its database, so we fall back to null.
 *
 * Everything is best-effort: network failures, timeouts, or markup changes
 * yield `null`, never a throw.
 */

import type { MeasureSourceData } from "./types";
import { fetchText } from "./fetch";
import { htmlToText } from "./html";

const BASE_URL = "https://lao.ca.gov";
const SOURCE_NAME = "California Legislative Analyst's Office";

/** Parse "Proposition 36", "Prop. 1A" → "36" / "1A". Null for non-props. */
export function parsePropositionNumber(title: string): string | null {
  const m = /\b(?:proposition|prop\.?)\s*#?\s*([0-9]+[a-z]?)\b/i.exec(title);
  return m?.[1] ? m[1].toUpperCase() : null;
}

const SECTION_PATTERNS = {
  fiscal: /\bfiscal\s+effect(?:s)?\b/i,
  fiscalSummary: /\bsummary\s+of\s+legislative\s+analyst(?:'s)?\s+estimate\b/i,
  yesNo: /\byes\s*\/\s*no\s+statement\b/i,
  ballotLabel: /\bballot\s+label\b/i,
  analysisOfMeasure: /\banalysis\s+of\s+measure\b/i,
};

function sliceSection(
  text: string,
  start: RegExp,
  stops: RegExp[],
): string | undefined {
  const startMatch = start.exec(text);
  if (!startMatch) return undefined;
  const from = startMatch.index + startMatch[0].length;
  let to = text.length;
  for (const stop of stops) {
    const m = stop.exec(text.slice(from));
    if (m && from + m.index < to) to = from + m.index;
  }
  const section = text.slice(from, to).trim();
  return section.length >= 40 ? section : undefined;
}

function clamp(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() + "…" : trimmed;
}

/**
 * Fetch and structure the LAO fiscal analysis for a single CA proposition.
 *
 * @param propNumber - e.g. "1", "36", "1A"
 * @param year       - election year, e.g. 2024
 */
export async function getCaLaoFiscal(
  propNumber: string,
  year: number,
): Promise<MeasureSourceData | null> {
  if (!propNumber) return null;

  const url = `${BASE_URL}/BallotAnalysis/Proposition?number=${encodeURIComponent(propNumber)}&year=${year}`;

  const html = await fetchText(url);
  if (!html || html.length < 500) return null;

  const text = htmlToText(html);
  if (text.length < 200) return null;

  // Deliberately narrow stop list — "background" and "proposal" are common words
  // that appear in fiscal text body and would prematurely truncate the section.
  const fiscalStops = [
    SECTION_PATTERNS.yesNo,
    SECTION_PATTERNS.ballotLabel,
    SECTION_PATTERNS.analysisOfMeasure,
  ];

  // Modern CMS pages have "Fiscal Effects" (h4.text-uppercase). Legacy pages
  // use "Fiscal Effect" (singular). sliceSection handles both via the regex.
  const fiscalImpact =
    sliceSection(text, SECTION_PATTERNS.fiscal, fiscalStops) ??
    sliceSection(text, SECTION_PATTERNS.fiscalSummary, [
      SECTION_PATTERNS.yesNo,
      SECTION_PATTERNS.ballotLabel,
    ]);

  if (!fiscalImpact) return null;

  return {
    tier: "state_sos",
    sourceName: SOURCE_NAME,
    sourceUrl: url,
    official: true,
    matchedTitle: `Proposition ${propNumber}`,
    fiscalImpact: clamp(fiscalImpact, 1200),
    fullText: clamp(text, 20_000),
    fullTextUrl: url,
  };
}

/**
 * Entry point for the cross-validation engine: given a Google Civic measure
 * title and election year, resolve and fetch the LAO fiscal analysis if any.
 *
 * Returns null for non-proposition titles or non-CA measures.
 */
export async function enrichFromLao(
  referendumTitle: string,
  stateAbbrev: string | undefined,
  electionYear: number,
): Promise<MeasureSourceData | null> {
  if (stateAbbrev && stateAbbrev.toUpperCase() !== "CA") return null;
  const propNumber = parsePropositionNumber(referendumTitle);
  if (!propNumber) return null;
  return getCaLaoFiscal(propNumber, electionYear);
}
