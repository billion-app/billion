/**
 * California Secretary of State Official Voter Information Guide scraper.
 *
 * Source: https://voterguide.sos.ca.gov — the official statewide voter guide.
 * These are *real, official* summaries written by the Attorney General and
 * fiscal analyses by the Legislative Analyst's Office (LAO). We extract and
 * structure them; we never author measure content here.
 *
 * Scope: California statewide propositions only. Local measures are handled by
 * the county pipelines (see santa-clara.ts).
 *
 * Everything is best-effort: network failures, timeouts, or markup changes
 * yield `null`/empty, never a throw. The cross-validation engine treats a
 * missing source as "no data from this tier".
 */

import type { MeasureSourceData } from "./types";
import { htmlToText } from "./html";

const GUIDE_BASE = "https://voterguide.sos.ca.gov";
const FETCH_TIMEOUT_MS = 12_000;
const SOURCE_NAME = "California Secretary of State — Official Voter Guide";

/**
 * Pull the proposition number out of a measure title.
 * Handles "Proposition 36", "Prop. 1", "Prop 1A", etc.
 */
export function parsePropositionNumber(title: string): string | null {
  const m = /\b(?:proposition|prop\.?)\s*#?\s*([0-9]+[a-z]?)\b/i.exec(title);
  return m?.[1] ? m[1].toUpperCase() : null;
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (compatible; BillionCivicBot/1.0; +https://billion.app)",
      },
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Section markers used in the SOS guide proposition pages. We slice text
 * between consecutive headings rather than relying on brittle CSS selectors.
 */
const SECTION_PATTERNS = {
  summary:
    /\b(official\s+title\s+and\s+summary|summary|what\s+your\s+vote\s+means)\b/i,
  fiscal:
    /\b(summary\s+of\s+legislative\s+analyst|fiscal\s+impact|estimate\s+of\s+(?:net\s+)?(?:state|fiscal)\b)/i,
  pro: /\b(argument\s+in\s+favor|arguments?\s+for)\b/i,
  con: /\b(argument\s+against|arguments?\s+against)\b/i,
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
  // Guard against pathological slices that are just heading fragments.
  return section.length >= 40 ? section : undefined;
}

/**
 * Fetch and structure a single statewide proposition from the SOS guide.
 *
 * @param propNumber - e.g. "1", "36", "1A"
 */
export async function getCaSosProposition(
  propNumber: string,
): Promise<MeasureSourceData | null> {
  // The guide URL structure has shifted over cycles; try the stable paths.
  const candidates = [
    `${GUIDE_BASE}/propositions/${propNumber}/`,
    `${GUIDE_BASE}/en/propositions/${propNumber}/`,
    `${GUIDE_BASE}/propositions/${propNumber}/index.htm`,
  ];

  let html: string | null = null;
  let usedUrl = candidates[0];
  for (const url of candidates) {
    html = await fetchText(url);
    if (html && html.length > 500) {
      usedUrl = url;
      break;
    }
  }
  if (!html) return null;

  const text = htmlToText(html);
  if (text.length < 200) return null;

  const summary = sliceSection(text, SECTION_PATTERNS.summary, [
    SECTION_PATTERNS.fiscal,
    SECTION_PATTERNS.pro,
    SECTION_PATTERNS.con,
  ]);
  const fiscalImpact = sliceSection(text, SECTION_PATTERNS.fiscal, [
    SECTION_PATTERNS.pro,
    SECTION_PATTERNS.con,
  ]);
  const proText = sliceSection(text, SECTION_PATTERNS.pro, [
    SECTION_PATTERNS.con,
  ]);
  const conText = sliceSection(text, SECTION_PATTERNS.con, [/\brebuttal\b/i]);

  // If we extracted nothing meaningful, treat as no data.
  if (!summary && !fiscalImpact && !proText && !conText) return null;

  const proClamped = clamp(proText, 1500);
  const conClamped = clamp(conText, 1500);

  return {
    tier: "state_sos",
    sourceName: SOURCE_NAME,
    sourceUrl: usedUrl,
    official: true,
    matchedTitle: `Proposition ${propNumber}`,
    officialSummary: clamp(summary, 1500),
    fiscalImpact: clamp(fiscalImpact, 1200),
    fullTextUrl: usedUrl,
    proArguments: proClamped
      ? [{ text: proClamped, sourceName: SOURCE_NAME, sourceUrl: usedUrl }]
      : undefined,
    conArguments: conClamped
      ? [{ text: conClamped, sourceName: SOURCE_NAME, sourceUrl: usedUrl }]
      : undefined,
  };
}

/**
 * Entry point for the cross-validation engine: given a Google Civic measure
 * title, resolve and fetch the matching CA statewide proposition if any.
 *
 * Returns null for non-proposition titles (local measures, etc.).
 */
export async function enrichFromCaSos(
  referendumTitle: string,
  stateAbbrev: string | undefined,
  // Election year is currently unused but kept for source-adapter symmetry and
  // future cycle-specific URL resolution.
  _electionYear: number,
): Promise<MeasureSourceData | null> {
  if (stateAbbrev && stateAbbrev.toUpperCase() !== "CA") return null;
  const propNumber = parsePropositionNumber(referendumTitle);
  if (!propNumber) return null;
  return getCaSosProposition(propNumber);
}

function clamp(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() + "…" : trimmed;
}
