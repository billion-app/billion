/**
 * Ballotpedia adapter — structured ballot-measure data for BOTH statewide
 * propositions and local (city/county/special-district) measures.
 *
 * Ballotpedia has no free JSON API (the MediaWiki api.php is disabled), so we
 * scrape the public, rendered article HTML. A realistic browser User-Agent is
 * required or the CloudFront WAF returns a 202/403 challenge (see fetch.ts).
 *
 * Article titles are long and exact and cannot be reliably constructed, so we
 * resolve the exact title from a Ballotpedia index page (statewide year index
 * or a county measures index) by matching on the measure letter/number, then
 * fetch and parse that article by its stable `mw-headline` section anchors.
 *
 * For local lettered measures the County Counsel / City Attorney "Impartial
 * Analysis" section is the authoritative NEUTRAL description; we extract it as
 * the summary so it outranks the advocacy/AI grounding fallback (SPUR).
 *
 * Every field is attributed back to the Ballotpedia article URL.
 */

import type { MeasureArgument, MeasureSourceData } from "./types";
import { fetchText } from "./fetch";
import { htmlToText } from "./html";

const SOURCE_NAME = "Ballotpedia";
const BASE = "https://ballotpedia.org";

/**
 * Parse candidate measure letter codes from a title, best guess first.
 *
 * Google Civic sometimes doubles the letter ("Measure D D", "Measure A A") for
 * a measure that is really just "Measure D". When the two letters are spaced
 * and identical we treat the single letter as the primary candidate and the
 * doubled form as a fallback. Genuinely double-lettered measures ("Measure AA",
 * Midpeninsula's Measure AA) are contiguous and kept as-is.
 */
export function parseMeasureCodes(title: string): string[] {
  // "D D" (same letter, spaced) → ["D", "DD"]; single → ["D"].
  const dup = /\bmeasure\s+([a-z])\s+([a-z])\b/i.exec(title);
  const [, first, second] = dup ?? [];
  if (first && first.toUpperCase() === second?.toUpperCase()) {
    const l = first.toUpperCase();
    return [l, l + l];
  }
  const m = /\bmeasure\s+([a-z]{1,2})\b/i.exec(title);
  return m?.[1] ? [m[1].toUpperCase()] : [];
}

/** Single best-guess letter, for callers that want just one code. */
export function parseMeasureLetter(title: string): string | null {
  return parseMeasureCodes(title)[0] ?? null;
}

function parsePropositionNumber(title: string): string | null {
  const m = /\b(?:proposition|prop\.?)\s*#?\s*([0-9]+[a-z]?)\b/i.exec(title);
  return m?.[1] ? m[1].toUpperCase() : null;
}

/**
 * Find candidate article hrefs on an index page that reference the given
 * measure code (letter or prop number). Returns absolute URLs, year-matching
 * ones first so we don't pick a same-letter measure from the wrong cycle.
 */
function findMeasureLinks(
  indexHtml: string,
  code: string,
  years: number[],
  requireYear: boolean,
): string[] {
  const exact: string[] = [];
  const rest: string[] = [];
  const seen = new Set<string>();
  const linkRe = /<a\b[^>]*href="(\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const codeRe = new RegExp(
    `\\b(?:measure|proposition|prop\\.?)[\\s_]+${escapeRe(code)}\\b`,
    "i",
  );
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(indexHtml))) {
    const href = m[1];
    const linkText = htmlToText(m[2] ?? "");
    // Match the code in either the visible text or the article slug.
    if (
      !href ||
      (!codeRe.test(linkText) && !codeRe.test(href.replace(/_/g, " ")))
    )
      continue;
    if (!/measure|proposition|prop|tax|bond|initiative/i.test(href)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    const url = BASE + href;
    const yearMatch = years.some((y) => href.includes(String(y)));
    if (yearMatch) exact.push(url);
    else if (!requireYear) rest.push(url);
    // When requireYear is set (local lettered measures, where the same letter
    // recurs across cycles/jurisdictions), drop non-year-matching links rather
    // than risk surfacing the wrong measure.
  }
  return [...exact, ...rest];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract the plaintext between a section heading and the next heading.
 * Ballotpedia wraps headings as `<span class="mw-headline" id="...">`.
 */
function sectionByAnchors(
  html: string,
  ids: string[],
  stopIds: string[],
): string | undefined {
  const anchor = (id: string) =>
    new RegExp(`<span[^>]*class="mw-headline"[^>]*id="${escapeRe(id)}"`, "i");
  // Honor list order: the first id that exists wins (not the earliest in the
  // document), so a more specific section like "Arguments_in_favor" is
  // preferred over a broader enclosing one like "Support".
  let startIdx = -1;
  for (const id of ids) {
    const a = anchor(id).exec(html);
    if (a) {
      startIdx = a.index;
      break;
    }
  }
  if (startIdx === -1) return undefined;
  const rest = html.slice(startIdx);
  let endRel = rest.length;
  for (const id of stopIds) {
    const a = anchor(id).exec(rest.slice(1));
    if (a && a.index + 1 < endRel) endRel = a.index + 1;
  }
  const text = htmlToText(rest.slice(0, endRel));
  return text.length >= 40 ? text : undefined;
}

function clamp(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  // Collapse the hard line wraps htmlToText leaves in, for clean prose display.
  const t = s
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

/** Index pages to search for the exact article title, most-specific first. */
function indexUrls(
  ctx: { county?: string; stateAbbrev?: string; year: number },
  isProp: boolean,
): string[] {
  const urls: string[] = [];
  if (isProp) {
    urls.push(`${BASE}/California_${ctx.year}_ballot_propositions`);
    urls.push(`${BASE}/California_${ctx.year - 1}_ballot_propositions`);
  }
  const county = ctx.county?.trim();
  if (county) {
    const slug = county.replace(/\s+/g, "_");
    urls.push(`${BASE}/${slug},_California_ballot_measures`);
  }
  // Santa Clara is the proving ground — always worth a look for local measures.
  urls.push(`${BASE}/Santa_Clara_County,_California_ballot_measures`);
  return [...new Set(urls)];
}

async function parseArticle(
  url: string,
  matchedTitle: string,
): Promise<MeasureSourceData | null> {
  const html = await fetchText(url);
  if (!html || html.length < 1000) return null;

  // The County Counsel / City Attorney "Impartial Analysis" is the authoritative
  // NEUTRAL per-measure description for local measures (CA Elec. Code §§9160/
  // 9280/9500) — preferred over the bare ballot question and far preferred over
  // the advocacy/AI fallback that runs when no official summary exists. Extract
  // it on its own so it can win the summary slot, not be buried in fiscal.
  const impartial = sectionByAnchors(
    html,
    ["Impartial_analysis", "Reports_and_analyses"],
    [
      "Fiscal_impact",
      "Text_of_measure",
      "Support",
      "Opposition",
      "See_also",
      "Path_to_the_ballot",
    ],
  );
  // Statewide props expose a "Ballot_summary"/"Measure_design"; local measures
  // instead carry the official wording under "Ballot_question" within
  // "Text_of_measure". Prefer the richer summary, then the neutral impartial
  // analysis, then the bare ballot question.
  const summary =
    sectionByAnchors(
      html,
      ["Ballot_summary", "Overview", "Measure_design"],
      ["Fiscal_impact", "Text_of_measure", "Support", "Opposition"],
    ) ??
    impartial ??
    sectionByAnchors(
      html,
      ["Ballot_question", "Text_of_measure"],
      ["Support", "Opposition", "Priority_actions", "Election_results"],
    );
  // Fiscal impact proper. The impartial analysis is no longer used as a fiscal
  // fallback — it now feeds the summary above.
  const fiscal = sectionByAnchors(
    html,
    ["Fiscal_impact", "Tax_rate"],
    [
      "Text_of_measure",
      "Support",
      "Opposition",
      "See_also",
      "Path_to_the_ballot",
    ],
  );
  const proText = sectionByAnchors(
    html,
    ["Arguments_in_favor", "Official_arguments", "Support"],
    ["Opposition", "Arguments_against", "Arguments_2", "Campaign_finance"],
  );
  const conText = sectionByAnchors(
    html,
    ["Arguments_against", "Arguments_2", "Opposition"],
    ["Reports_and_analyses", "Campaign_finance", "Media_editorial", "See_also"],
  );

  if (!summary && !fiscal && !proText && !conText) return null;

  // Strip leading section-heading noise Ballotpedia leaves in the slice
  // ("Ballot question", "The question on the ballot: [2]", stray quotes/refs).
  // These can stack on separate lines, so strip repeatedly until stable.
  let cleanSummary = summary;
  if (cleanSummary) {
    const noise =
      /^\s*(?:impartial analysis|reports and analyses|the following impartial analysis[^:]*:|ballot question|text of measure|the (?:ballot )?question(?: on the ballot)?(?: was)?(?: as follows)?:?|\[\d+\]|[“”"])\s*/i;
    let prev: string;
    do {
      prev = cleanSummary;
      cleanSummary = cleanSummary.replace(noise, "");
    } while (cleanSummary !== prev);
    cleanSummary = cleanSummary.trim();
  }

  const arg = (t: string | undefined): MeasureArgument[] | undefined =>
    t ? [{ text: t, sourceName: SOURCE_NAME, sourceUrl: url }] : undefined;

  return {
    tier: "ballotpedia",
    sourceName: SOURCE_NAME,
    sourceUrl: url,
    official: false,
    matchedTitle,
    officialSummary: clamp(cleanSummary, 1500),
    fiscalImpact: clamp(fiscal, 1200),
    fullTextUrl: url,
    proArguments: arg(clamp(proText, 1500)),
    conArguments: arg(clamp(conText, 1500)),
  };
}

/**
 * Resolve and scrape the Ballotpedia article for a measure.
 *
 * @param title Measure title from Google Civic.
 * @param ctx   stateAbbrev / county / electionYear for index resolution.
 */
export async function enrichFromBallotpedia(
  title: string,
  ctx: { stateAbbrev?: string; county?: string; electionYear: number },
): Promise<MeasureSourceData | null> {
  const prop = parsePropositionNumber(title);
  const codes = prop ? [prop] : parseMeasureCodes(title);
  if (!codes.length) return null;

  const indexes = indexUrls(
    {
      county: ctx.county,
      stateAbbrev: ctx.stateAbbrev,
      year: ctx.electionYear,
    },
    !!prop,
  );

  const years = [ctx.electionYear, ctx.electionYear - 1];
  // Statewide props come from a year-scoped index, so the year is implied.
  // Local lettered measures share a single county index across all cycles, so
  // we must require a year match to avoid picking a same-letter measure from
  // the wrong year/jurisdiction.
  const requireYear = !prop;

  // Fetch each index once, then try every candidate code against it.
  for (const indexUrl of indexes) {
    const indexHtml = await fetchText(indexUrl);
    if (!indexHtml) continue;
    for (const code of codes) {
      const matchedTitle = prop ? `Proposition ${prop}` : `Measure ${code}`;
      const links = findMeasureLinks(indexHtml, code, years, requireYear);
      for (const link of links.slice(0, 3)) {
        const result = await parseArticle(link, matchedTitle);
        if (result) return result;
      }
    }
  }

  return null;
}
