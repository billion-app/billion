/**
 * Wikipedia adapter — encyclopedic biography for a candidate.
 *
 * Wikipedia has no API key (the action API is public), so unlike the Vote Smart
 * / Open States adapters there is no key to gate on. The real gate here is the
 * COLLISION guard: a bare candidate name ("John Smith") matches a disambiguation
 * page or an unrelated person, so before we surface anything we require the
 * fetched intro extract to both (a) read like a biography of a real person and
 * (b) mention politics/office/election context. We also prefer a query that
 * appends the office + state so the action API's title search lands on the
 * political figure rather than a more famous namesake.
 *
 * Yields a biography (the intro extract) and, when available, a photo from the
 * `pageimages` property. Always carries the article URL for attribution. Best-
 * effort: any failure, miss, or failed guard yields `null`, never a throw.
 */

import type { CandidateSourceData } from "./types";
import { fetchJson } from "../measure-sources/fetch";

const WIKI_UA = "BillionCivicBot/1.0 (https://billion.app; civic@billion.app)";
const SOURCE_NAME = "Wikipedia";

/** Extract must be at least this long to be a usable biography (collision guard). */
const MIN_EXTRACT_CHARS = 100;
/** Clamp the biography so a long lead doesn't dominate the card. */
const MAX_BIO_CHARS = 800;

/**
 * Keywords that signal the article is about a politician / political figure
 * rather than an unrelated namesake or a disambiguation page. The extract must
 * contain at least one of these for us to trust the match.
 */
const POLITICAL_KEYWORDS = [
  "politician",
  "election",
  "elected",
  "candidate",
  "incumbent",
  "office",
  "senator",
  "senate",
  "representative",
  "assembly",
  "assemblymember",
  "congress",
  "congressman",
  "congresswoman",
  "governor",
  "mayor",
  "council",
  "councilmember",
  "supervisor",
  "legislature",
  "legislator",
  "democrat",
  "republican",
  "political party",
  "ran for",
  "running for",
  "campaign",
];

/** Map two-letter state abbreviations to full names for query/context matching. */
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

interface WikiThumbnail {
  source?: string;
  width?: number;
  height?: number;
}

interface WikiPage {
  pageid?: number;
  missing?: string;
  title?: string;
  extract?: string;
  thumbnail?: WikiThumbnail;
  original?: WikiThumbnail;
}

interface ExtractResponse {
  query?: {
    pages?: Record<string, WikiPage>;
  };
}

/**
 * Does the extract read like the biography of a political figure, and (when we
 * know the contest) does it actually corroborate THIS candidate's state? This
 * is the core defense against namesake / disambiguation collisions. We require:
 *   1. enough text to be a real lead (not a stub / disambiguation list),
 *   2. at least one political keyword, and
 *   3. when the state is known, contest corroboration (`requireContest`): the
 *      state name appears in the extract. The caller enforces this for EVERY
 *      query when a state is known, so a same-name politician from another state
 *      can't slip through even a disambiguating "<Name> (politician)" title.
 */
function looksLikePolitician(
  extract: string,
  stateName: string | undefined,
  requireContest: boolean,
): boolean {
  if (extract.length < MIN_EXTRACT_CHARS) return false;

  const lower = extract.toLowerCase();

  // Disambiguation pages have a tell-tale lead; never surface them.
  if (lower.includes("may refer to") || lower.includes("disambiguation")) {
    return false;
  }

  const hasPolitical = POLITICAL_KEYWORDS.some((k) => lower.includes(k));
  if (!hasPolitical) return false;

  // When we know the state, require the STATE NAME to appear so we don't surface
  // a same-name politician from another state. A generic office keyword
  // ("representative", "council") is deliberately NOT enough on its own — a
  // wrong-state namesake in the same kind of office would pass it; the state name
  // is the only strong per-candidate signal. A real candidate's own article
  // almost always names their state.
  if (stateName && requireContest) {
    const stateHit = lower.includes(stateName.toLowerCase());
    if (!stateHit) return false;
  }

  return true;
}

/** Build the Wikipedia article URL from the resolved page title. */
function articleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(
    title.replace(/ /g, "_"),
  )}`;
}

/** Pick the best available photo URL from a page's image properties. */
function pickPhoto(page: WikiPage): string | undefined {
  const url = page.thumbnail?.source ?? page.original?.source;
  if (!url) return undefined;
  // Only surface real https image URLs.
  return /^https:\/\/.+\.(jpe?g|png|gif|webp)$/i.test(url) ? url : undefined;
}

/**
 * Query the Wikipedia action API for a single title and return the first page,
 * following redirects. Returns null on any failure or a missing page.
 */
async function fetchPage(title: string): Promise<WikiPage | null> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&format=json" +
    "&prop=extracts%7Cpageimages&exintro=1&explaintext=1&redirects=1" +
    "&piprop=thumbnail%7Coriginal&pithumbsize=400&titles=" +
    encodeURIComponent(title);
  const data = await fetchJson<ExtractResponse>(url, WIKI_UA);
  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;
  return page;
}

/**
 * Look up a candidate's Wikipedia biography.
 *
 * @param name  Candidate name from Google Civic (e.g. "Gavin Newsom").
 * @param ctx   Contest context used to disambiguate from namesakes.
 */
export async function enrichCandidateFromWikipedia(
  name: string,
  ctx: { office?: string; stateAbbrev?: string; electionYear: number },
): Promise<CandidateSourceData | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const stateAbbrev = ctx.stateAbbrev?.toUpperCase();
  const stateName = stateAbbrev ? STATE_NAMES[stateAbbrev] : undefined;

  // Try the most disambiguating titles first so the action API's title search
  // lands on the political figure rather than a more famous namesake:
  //   1. "<Name> (politician)"   — Wikipedia's own disambiguation convention
  //   2. "<Name> <State> politician"
  //   3. "<Name> politician"
  //   4. "<Name>"                — bare name, last resort (collision-prone)
  const queries = [
    `${trimmed} (politician)`,
    stateName ? `${trimmed} ${stateName} politician` : undefined,
    `${trimmed} politician`,
    trimmed,
  ].filter((q): q is string => Boolean(q));

  for (const query of queries) {
    const page = await fetchPage(query);
    if (!page) continue;

    const extract = (page.extract ?? "").trim();
    // When we know the state, require contest corroboration for EVERY query —
    // not just the bare-name one. A "<Name> (politician)" title can resolve to a
    // same-name politician in another state and pass the name-token + political
    // checks; only state corroboration rejects that namesake. A real candidate's
    // own article almost always names their state.
    const requireContest = Boolean(stateName);
    if (!looksLikePolitician(extract, stateName, requireContest)) continue;

    const title = page.title ?? trimmed;

    // Defense in depth: the resolved article title should still be the
    // candidate's name (redirects can land on an unrelated subject). We accept
    // the page only if the candidate's name tokens appear in the title.
    const titleLower = title.toLowerCase();
    const nameOk = trimmed
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1)
      .every((t) => titleLower.includes(t));
    if (!nameOk) continue;

    const biography =
      extract.length > MAX_BIO_CHARS
        ? extract.slice(0, MAX_BIO_CHARS).trimEnd() + "…"
        : extract;

    const url = articleUrl(title);
    return {
      tier: "wikipedia",
      sourceName: SOURCE_NAME,
      sourceUrl: url,
      official: false,
      matchedName: title,
      biography,
      photoUrl: pickPhoto(page),
    };
  }

  return null;
}
