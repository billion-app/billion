/**
 * California SOS Voter Information Guide *archive* parser.
 *
 * Source: https://vigarchive.sos.ca.gov — the historical VIG covering statewide
 * propositions from 1996 to present. Unlike the live voter guide
 * (voterguide.sos.ca.gov, see ./ca-sos-voterguide.ts) the archive exposes one
 * stable page per proposition per election:
 *
 *   /{year}/{election-type}/propositions/{N}/                  (summary + short pro/con)
 *   /{year}/{election-type}/propositions/{N}/arguments-rebuttals.htm  (full pro/con + rebuttals)
 *
 * This module is PURE: HTML in, structured data out, no network and no DB. The
 * scraper (apps/scraper/.../ca-vig-archive.ts) does the fetching and writes the
 * parsed result into CivicApiCache; the cross-validation engine reads it back at
 * request time keyed by election year + proposition number.
 *
 * Everything is best-effort and defensive — markup drift yields empty/undefined
 * fields, never a throw — matching the rest of measure-sources/.
 */

import { stableStringify } from "../candidate-sources/types";
import { htmlToText } from "./html";

export const VIG_ARCHIVE_ROOT = "https://vigarchive.sos.ca.gov";
export const VIG_ARCHIVE_SOURCE_NAME =
  "California Secretary of State — Voter Information Guide Archive";

/** A single election present in the archive index (e.g. 2024 general). */
export interface VigElection {
  year: number;
  /** "general" | "primary" | "special" | "feb" | "june" | "" (bare-year specials). */
  electionType: string;
  /** Canonical path with leading + trailing slash, e.g. "/2024/general/". */
  path: string;
}

/** Structured content for one archived proposition. */
export interface VigArchiveProp {
  year: number;
  electionType: string;
  /** Proposition number as printed, e.g. "2", "1A". */
  propNumber: string;
  title: string;
  /** Official summary block (incl. fiscal impact / supporters / opponents lines). */
  summary?: string;
  /** "WHAT YOUR VOTE MEANS" block (YES/NO plain-language explanation). */
  voteMeans?: string;
  /** Short argument printed on the prop page itself. */
  proShort?: string;
  conShort?: string;
  /** Full arguments + rebuttals from arguments-rebuttals.htm. */
  proArgument?: string;
  conArgument?: string;
  proRebuttal?: string;
  conRebuttal?: string;
  sourceUrl: string;
}

/* ------------------------------------------------------------------ URLs -- */

export function propsIndexUrl(el: VigElection): string {
  return `${VIG_ARCHIVE_ROOT}${el.path}propositions/`;
}

export function propPageUrl(el: VigElection, propNumber: string): string {
  return `${VIG_ARCHIVE_ROOT}${el.path}propositions/${propNumber}/`;
}

export function argsRebuttalsUrl(el: VigElection, propNumber: string): string {
  return `${propPageUrl(el, propNumber)}arguments-rebuttals.htm`;
}

/* --------------------------------------------------------------- Indexes -- */

/**
 * Parse the archive root into the list of elections it links to. The root uses
 * relative hrefs like `2024/general/`, `2008/feb/`, `2003/special/`, and a few
 * bare `2021/` (the recall) — we normalise all of them to `/{year}/{type}/`.
 */
export function parseArchiveIndex(html: string): VigElection[] {
  const seen = new Set<string>();
  const out: VigElection[] = [];
  const re = /href="\/?(?:past\/)?((?:19|20)\d{2})\/([a-z]*)\/?"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const year = Number(m[1]);
    const electionType = (m[2] ?? "").toLowerCase();
    const path = electionType ? `/${year}/${electionType}/` : `/${year}/`;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push({ year, electionType, path });
  }
  return out.sort((a, b) => a.year - b.year || a.electionType.localeCompare(b.electionType));
}

/**
 * Parse a `/propositions/` index page into the ordered list of proposition
 * numbers it links to (deduped, e.g. ["2", "3", "4", "5", "6", "32", ...]).
 */
export function parsePropIndex(html: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /href="[^"]*\/propositions\/(\d+[a-z]?)\/?"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const n = m[1]!.toUpperCase();
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/* --------------------------------------------------------------- Slicing -- */

/** Heading lines render on their own line; anchor markers to line starts. */
function lineMarker(pattern: string): RegExp {
  return new RegExp(`(?:^|\\n)\\s*${pattern}[^\\n]*`, "i");
}

/**
 * Slice the text between `start` and the earliest of `stops`. Returns undefined
 * when the section is missing or only a heading fragment.
 */
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
  return section.length >= 20 ? section : undefined;
}

function clamp(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

/* ----------------------------------------------------------- Prop parser -- */

const M = {
  summary: lineMarker("SUMMARY"),
  voteMeans: lineMarker("WHAT YOUR VOTE MEANS"),
  args: lineMarker("ARGUMENTS"),
  forInfo: lineMarker("FOR ADDITIONAL INFORMATION"),
  pro: lineMarker("PRO"),
  con: lineMarker("CON"),
  // Sidebar headings that follow the main content in document order — used as
  // hard stops so a missing section can't bleed into the nav rail.
  sidebar: /(?:^|\n)\s*(Propositions|Dates to Remember|Voter Information Guide)\b/i,
};

/**
 * Parse a single proposition page (the `/propositions/{N}/` URL) into its
 * title, summary, vote-means block, and short pro/con arguments.
 */
export function parsePropPage(
  html: string,
): Pick<
  VigArchiveProp,
  "propNumber" | "title" | "summary" | "voteMeans" | "proShort" | "conShort"
> | null {
  const text = htmlToText(html);
  if (text.length < 200) return null;

  // "PROP 2" → number; the official title is the next non-empty line up to SUMMARY.
  const propMatch = /(?:^|\n)\s*PROP\s+#?\s*(\d+[A-Z]?)\b/i.exec(text);
  const propNumber = propMatch?.[1]?.toUpperCase();
  if (!propNumber) return null;

  const titleSlice = sliceSection(
    text,
    new RegExp(`PROP\\s+#?\\s*${propNumber}\\b`, "i"),
    [M.summary],
  );
  const title = clamp(titleSlice, 300) ?? `Proposition ${propNumber}`;

  const summary = clamp(
    sliceSection(text, M.summary, [M.voteMeans, M.args, M.sidebar]),
    2000,
  );
  const voteMeans = clamp(
    sliceSection(text, M.voteMeans, [M.args, M.forInfo, M.sidebar]),
    1500,
  );

  // The short arguments live under the ARGUMENTS heading as PRO / CON blocks.
  const argsBlock = sliceSection(text, M.args, [M.forInfo, M.sidebar]) ?? "";
  const proShort = clamp(sliceSection(argsBlock, M.pro, [M.con]), 1500);
  const conShort = clamp(sliceSection(argsBlock, M.con, [M.sidebar]), 1500);

  return { propNumber, title, summary, voteMeans, proShort, conShort };
}

/* ------------------------------------------------------ Args/rebuttals -- */

const A = {
  proArg: lineMarker("ARGUMENT IN FAVOR"),
  proReb: lineMarker("REBUTTAL TO ARGUMENT IN FAVOR"),
  conArg: lineMarker("ARGUMENT AGAINST"),
  conReb: lineMarker("REBUTTAL TO ARGUMENT AGAINST"),
  sidebar: M.sidebar,
};

/**
 * Parse arguments-rebuttals.htm into the four full-length sections. The page
 * always orders them FAVOR → REBUTTAL-TO-FAVOR → AGAINST → REBUTTAL-TO-AGAINST.
 */
export function parseArgsRebuttals(html: string): Pick<
  VigArchiveProp,
  "proArgument" | "conArgument" | "proRebuttal" | "conRebuttal"
> {
  const text = htmlToText(html);
  return {
    proArgument: clamp(sliceSection(text, A.proArg, [A.proReb]), 4000),
    proRebuttal: clamp(sliceSection(text, A.proReb, [A.conArg]), 4000),
    conArgument: clamp(sliceSection(text, A.conArg, [A.conReb]), 4000),
    conRebuttal: clamp(sliceSection(text, A.conReb, [A.sidebar]), 4000),
  };
}

/* --------------------------------------------------------- Cache handoff -- */

/** CivicApiCache.addressHash for the VIG archive handoff (global, not per-address). */
export const VIG_ARCHIVE_ADDRESS_HASH = "__global__";
/** CivicApiCache.endpoint namespace for the VIG archive handoff. */
export const VIG_ARCHIVE_ENDPOINT = "ca-vig-archive";

/** Payload stored in CivicApiCache.responseData — one row per election. */
export interface VigArchivePayload {
  props: VigArchiveProp[];
}

/**
 * Build the CivicApiCache.params string for one election. Single source of
 * truth so the scraper write and the adapter read never drift (a mismatch is a
 * silent cache miss). Mirrors caSosCacheParams in candidate-sources/ca-sos-cache.
 */
export function vigArchiveCacheParams(
  year: number,
  electionType: string,
): string {
  return stableStringify({ year, electionType });
}
