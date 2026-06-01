/**
 * CaVotes adapter — League of Women Voters of California Education Fund
 * "Pros & Cons" / Easy Voter Guide nonpartisan analysis.
 *
 * Replaces the old, useless easyvoterguide.org homepage scrape. CaVotes
 * exposes a clean public WordPress REST API (no auth, no Cloudflare) with one
 * `ballot` post per statewide proposition, server-rendered into
 * `content.rendered`.
 *
 * Scope: California STATEWIDE propositions only (0 of its entries are local
 * lettered measures). Yields summary + fiscal + pro/con, all nonpartisan and
 * source-attributed back to cavotes.org.
 */

import type { MeasureArgument, MeasureSourceData } from "./types";
import { fetchJson } from "./fetch";
import { htmlToText } from "./html";
import { parsePropositionNumber } from "./wikipedia";

const SOURCE_NAME = "League of Women Voters of California — Pros & Cons";
const API_LIST =
  "https://cavotes.org/wp-json/wp/v2/ballots?per_page=100&_fields=id,slug,title,link";

interface BallotListItem {
  slug: string;
  link: string;
  title?: { rendered?: string };
}

interface BallotDetail {
  slug: string;
  link: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
}

/** Heading vocabularies vary by cycle; map both to canonical sections. */
const HEADINGS = {
  summary: /\b(the question|the proposal|what .* would do|the situation|the way it is now)\b/i,
  fiscal: /\b(fiscal (effects|impact))\b/i,
  pro: /\b(supporters say|people for|arguments? in favor)\b/i,
  con: /\b(opponents say|people against|arguments? against)\b/i,
};

function sliceSection(
  text: string,
  start: RegExp,
  stops: RegExp[],
): string | undefined {
  const m = start.exec(text);
  if (!m) return undefined;
  const from = m.index + m[0].length;
  let to = text.length;
  for (const stop of stops) {
    const sm = stop.exec(text.slice(from));
    if (sm && from + sm.index < to) to = from + sm.index;
  }
  const section = text.slice(from, to).trim();
  return section.length >= 40 ? section : undefined;
}

function clamp(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const t = s.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

/**
 * @param title       Measure title (must contain a proposition number).
 * @param stateAbbrev Two-letter state; only CA supported.
 * @param year        Election year, used to disambiguate the slug.
 */
export async function enrichFromCaVotes(
  title: string,
  stateAbbrev: string | undefined,
  year: number,
): Promise<MeasureSourceData | null> {
  if (stateAbbrev && stateAbbrev.toUpperCase() !== "CA") return null;
  const prop = parsePropositionNumber(title);
  if (!prop) return null;

  const list = await fetchJson<BallotListItem[]>(API_LIST);
  if (!list?.length) return null;

  // Slugs are inconsistent across years (2024-prop-36, prop-1-2024,
  // prop-50-2025). Match on both the prop number and the year appearing
  // somewhere in the slug.
  const propLc = prop.toLowerCase();
  const yearStr = String(year);
  const prevStr = String(year - 1);
  const match = list.find((b) => {
    const s = b.slug.toLowerCase();
    const hasProp = new RegExp(`(^|[^0-9a-z])prop[-_]?${propLc}([^0-9a-z]|$)`).test(s);
    const hasYear = s.includes(yearStr) || s.includes(prevStr);
    return hasProp && hasYear;
  });
  if (!match) return null;

  const detail = await fetchJson<BallotDetail[]>(
    `https://cavotes.org/wp-json/wp/v2/ballots?slug=${encodeURIComponent(
      match.slug,
    )}&_fields=slug,link,title,content`,
  );
  const post = detail?.[0];
  const rendered = post?.content?.rendered;
  if (!rendered) return null;

  // Strip Stackable inline <style>/<script> noise before extracting text.
  const text = htmlToText(rendered);
  if (text.length < 120) return null;

  const summary = sliceSection(text, HEADINGS.summary, [
    HEADINGS.fiscal,
    HEADINGS.pro,
    HEADINGS.con,
  ]);
  const fiscal = sliceSection(text, HEADINGS.fiscal, [
    HEADINGS.pro,
    HEADINGS.con,
  ]);
  const proText = sliceSection(text, HEADINGS.pro, [HEADINGS.con]);
  const conText = sliceSection(text, HEADINGS.con, [
    /\b(for more information|learn more|sources?)\b/i,
  ]);

  if (!summary && !fiscal && !proText && !conText) return null;

  const url = post.link;
  const arg = (t: string | undefined): MeasureArgument[] | undefined =>
    t ? [{ text: t, sourceName: SOURCE_NAME, sourceUrl: url }] : undefined;

  return {
    tier: "lwv",
    sourceName: SOURCE_NAME,
    sourceUrl: url,
    official: false,
    matchedTitle: post.title?.rendered ?? `Proposition ${prop}`,
    officialSummary: clamp(summary, 1500),
    fiscalImpact: clamp(fiscal, 1200),
    fullTextUrl: url,
    proArguments: arg(clamp(proText, 1500)),
    conArguments: arg(clamp(conText, 1500)),
  };
}
