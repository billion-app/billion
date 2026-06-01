/**
 * Santa Clara County local ballot-measure pipeline (the proving ground).
 *
 * Local measures (city/county) are not covered by Vote Smart or the statewide
 * SOS guide. The county Registrar of Voters publishes measure text, impartial
 * analyses, and pro/con arguments, but its site (vote.santaclaracounty.gov)
 * sits behind Cloudflare bot protection. We therefore:
 *
 *   1. Try the county's published measure pages defensively (fetch + regex).
 *   2. Fall back to the League of Women Voters Easy Voter Guide, which carries
 *      nonpartisan local measure explanations.
 *
 * As with the SOS scraper, AI is never used here to author content — we only
 * extract and structure existing public-record text. Failures yield null.
 */

import type { MeasureSourceData } from "./types";
import { htmlToText } from "./html";

const FETCH_TIMEOUT_MS = 12_000;

const SCC_ROV_NAME = "Santa Clara County Registrar of Voters";
const SCC_ROV_MEASURES_URL = "https://vote.santaclaracounty.gov/vote/measures";

const LWV_NAME = "League of Women Voters — Easy Voter Guide";
const LWV_LOCAL_URL = "https://www.easyvoterguide.org/";

/** Counties this pipeline knows how to handle, keyed by normalized name. */
const SUPPORTED_COUNTIES = new Set(["santa clara", "santa clara county"]);

/**
 * Local measures are lettered ("Measure A", "Measure B"), not numbered like
 * statewide props. Extract the letter code for matching.
 */
export function parseMeasureLetter(title: string): string | null {
  const m = /\bmeasure\s+([a-z]{1,2})\b/i.exec(title);
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
    // Cloudflare challenge, timeout, DNS, etc. — treated as "no data".
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Find the block of text describing a given lettered measure within a page's
 * full text. Slices from the "Measure X" heading to the next "Measure Y".
 */
function sliceMeasureBlock(text: string, letter: string): string | undefined {
  const start = new RegExp(`\\bmeasure\\s+${letter}\\b`, "i").exec(text);
  if (!start) return undefined;
  const from = start.index;
  const next = /\bmeasure\s+[a-z]{1,2}\b/i.exec(
    text.slice(from + start[0].length),
  );
  const to = next ? from + start[0].length + next.index : text.length;
  const block = text.slice(from, to).trim();
  return block.length >= 60 ? block : undefined;
}

const FISCAL_RE =
  /\b(fiscal\s+impact|tax\s+rate|cost\s+(?:to|of)|annual\s+cost|per\s+\$?\s*100,?000)\b[\s\S]{0,400}/i;

function extractFiscal(block: string): string | undefined {
  const m = FISCAL_RE.exec(block);
  return m?.[0]?.trim();
}

/**
 * Attempt to enrich a local Santa Clara County measure.
 *
 * @param referendumTitle - e.g. "Measure A" (from Google Civic)
 * @param county - normalized county name from the address, if known
 */
export async function enrichFromSantaClara(
  referendumTitle: string,
  county?: string,
): Promise<MeasureSourceData | null> {
  // Only run for Santa Clara County, or when county is unknown but the title
  // looks local (lettered) — the proving-ground scope from the plan.
  const normalizedCounty = county?.toLowerCase().trim();
  const letter = parseMeasureLetter(referendumTitle);
  if (!letter) return null;
  if (normalizedCounty && !SUPPORTED_COUNTIES.has(normalizedCounty)) {
    return null;
  }

  // 1. County Registrar (official, highest tier) — may be Cloudflare-blocked.
  const rovHtml = await fetchText(SCC_ROV_MEASURES_URL);
  if (rovHtml) {
    const block = sliceMeasureBlock(htmlToText(rovHtml), letter);
    if (block) {
      return {
        tier: "county_registrar",
        sourceName: SCC_ROV_NAME,
        sourceUrl: SCC_ROV_MEASURES_URL,
        official: true,
        matchedTitle: `Measure ${letter}`,
        officialSummary: clamp(block, 1500),
        fiscalImpact: clamp(extractFiscal(block), 800),
        fullTextUrl: SCC_ROV_MEASURES_URL,
      };
    }
  }

  // 2. League of Women Voters Easy Voter Guide (nonpartisan, lower tier).
  const lwvHtml = await fetchText(LWV_LOCAL_URL);
  if (lwvHtml) {
    const block = sliceMeasureBlock(htmlToText(lwvHtml), letter);
    if (block) {
      return {
        tier: "county_registrar",
        sourceName: LWV_NAME,
        sourceUrl: LWV_LOCAL_URL,
        official: false,
        matchedTitle: `Measure ${letter}`,
        officialSummary: clamp(block, 1200),
        fullTextUrl: LWV_LOCAL_URL,
      };
    }
  }

  return null;
}

function clamp(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() + "…" : trimmed;
}
