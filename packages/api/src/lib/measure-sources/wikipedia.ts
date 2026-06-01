/**
 * Wikipedia adapter — neutral encyclopedic overviews of California statewide
 * propositions.
 *
 * Scope: STATEWIDE props only. Wikipedia has a dedicated, NPOV article for
 * every recent CA proposition ("2024 California Proposition 36"), but local
 * lettered measures have no article and bare titles collide with unrelated
 * topics (e.g. "Measure Q" → "Risk-neutral measure"). We therefore gate hard
 * on a parsed proposition number and never run on local titles.
 *
 * Yields a summary only (no fiscal/pro/con — those come from SOS/Ballotpedia).
 * Always carries the article URL so the app can point back to the source.
 */

import type { MeasureSourceData } from "./types";
import { fetchJson } from "./fetch";

const WIKI_UA = "BillionCivicBot/1.0 (https://billion.app; civic@billion.app)";
const SOURCE_NAME = "Wikipedia";

/** Parse "Proposition 36", "Prop. 1A" → "36" / "1A". Null for non-props. */
export function parsePropositionNumber(title: string): string | null {
  const m = /\b(?:proposition|prop\.?)\s*#?\s*([0-9]+[a-z]?)\b/i.exec(title);
  return m?.[1] ? m[1].toUpperCase() : null;
}

interface ExtractResponse {
  query?: {
    pages?: Record<
      string,
      { missing?: string; extract?: string; title?: string }
    >;
  };
}

/**
 * Fetch the intro extract for a CA statewide proposition.
 *
 * @param title       Measure title from Google Civic (e.g. "Proposition 36").
 * @param stateAbbrev Two-letter state; only "CA" is supported here.
 * @param year        Election year, used to build the article title.
 */
export async function enrichFromWikipedia(
  title: string,
  stateAbbrev: string | undefined,
  year: number,
): Promise<MeasureSourceData | null> {
  if (stateAbbrev && stateAbbrev.toUpperCase() !== "CA") return null;
  const prop = parsePropositionNumber(title);
  if (!prop) return null;

  // Try the exact-year title first, then the prior year (props often span the
  // turn of a cycle), via the redirects-following action API.
  const candidates = [
    `${year} California Proposition ${prop}`,
    `${year - 1} California Proposition ${prop}`,
  ];

  for (const articleTitle of candidates) {
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&format=json" +
      "&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=" +
      encodeURIComponent(articleTitle);
    const data = await fetchJson<ExtractResponse>(url, WIKI_UA);
    const pages = data?.query?.pages;
    if (!pages) continue;
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined || !page.extract) continue;
    const extract = page.extract.trim();
    if (extract.length < 80) continue;

    const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(
      (page.title ?? articleTitle).replace(/ /g, "_"),
    )}`;
    return {
      tier: "wikipedia",
      sourceName: SOURCE_NAME,
      sourceUrl: pageUrl,
      official: false,
      matchedTitle: page.title ?? articleTitle,
      officialSummary: extract.length > 1500 ? extract.slice(0, 1500) + "…" : extract,
      fullTextUrl: pageUrl,
    };
  }

  return null;
}
