/**
 * California Secretary of State Official Voter Information Guide — candidate
 * statements scraper.
 *
 * Source: https://voterguide.sos.ca.gov/candidates — the official statewide
 * voter guide. Each candidate for a statewide office submits a written
 * statement that the SOS publishes verbatim; this is the same text printed in
 * the mailed voter guide packet. We extract and structure it; we never author
 * candidate content here.
 *
 * Scope: California STATEWIDE offices only (Governor, Lt. Governor, Attorney
 * General, etc.). Local, legislative, and congressional races are NOT in this
 * guide — those are covered (or left sparse) by other adapters. We gate hard on
 * stateAbbrev === "CA" and on the office mapping below; anything we can't map to
 * a known statewide office page returns null.
 *
 * Mirrors the measure-side SOS adapter (../measure-sources/ca-sos-voterguide.ts)
 * and every other candidate source: best-effort, never throws, returns `null`
 * (not a partial object) when it cannot confidently match a candidate. The
 * cross-validation engine treats a missing source as "no data from this tier".
 *
 * Trust: tier `state_sos`, `official: true` — outranks every aggregator
 * (Ballotpedia, Wikipedia, Vote Smart) in the merge, second only to a county
 * registrar.
 */

import type { CandidateChannel, CandidateSourceData } from "./types";
import { decodeEntities, htmlToText } from "../measure-sources/html";
import { candidateNameSimilarity, clamp, dropInitials } from "./types";

const GUIDE_BASE = "https://voterguide.sos.ca.gov";
const FETCH_TIMEOUT_MS = 12_000;
const SOURCE_NAME =
  "California Secretary of State — Official Voter Information Guide";
/** Accept a candidate page heading as the same person at/above this similarity. */
const NAME_MATCH_THRESHOLD = 0.7;
/** Statements are short; clamp defensively so one bad slice can't dump the page. */
const MAX_BIO_CHARS = 2500;

/**
 * Map a Google Civic office string to the SOS guide's URL slug.
 *
 * Google Civic office names vary ("Governor of California", "Governor",
 * "California Governor"), so we match on keyword presence rather than equality.
 * Order matters: more specific entries (e.g. "lieutenant governor",
 * "superintendent of public instruction") must precede the generic ones they
 * contain so "lieutenant governor" doesn't match the bare "governor" rule.
 *
 * Only the nine statewide offices the guide publishes are here; an unmatched
 * office yields null (the adapter returns no data, never a wrong page).
 */
const OFFICE_SLUGS: { match: RegExp; slug: string }[] = [
  { match: /lieutenant\s+governor|lt\.?\s+governor/i, slug: "lt-governor" },
  {
    match: /superintendent\s+of\s+public\s+instruction/i,
    slug: "superintendent",
  },
  { match: /insurance\s+commissioner/i, slug: "insurance-commissioner" },
  { match: /attorney\s+general/i, slug: "attorney-general" },
  { match: /secretary\s+of\s+state/i, slug: "sos" },
  { match: /\bcontroller\b/i, slug: "controller" },
  { match: /\btreasurer\b/i, slug: "treasurer" },
  {
    match: /board\s+of\s+equalization|\bboe\b/i,
    slug: "boe",
  },
  { match: /\bgovernor\b/i, slug: "governor" },
];

function officeSlug(office: string | undefined): string | null {
  if (!office) return null;
  for (const { match, slug } of OFFICE_SLUGS) {
    if (match.test(office)) return slug;
  }
  return null;
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
 * One candidate section sliced out of an office page: the raw inner HTML
 * between this candidate's heading and the next (or end of the candidate list).
 */
interface RawSection {
  /** Heading text, e.g. "Katie Porter | DEMOCRATIC". */
  heading: string;
  /** Inner HTML from just after this heading up to the next heading. */
  body: string;
}

/**
 * Split an office page into per-candidate sections.
 *
 * The guide marks each candidate with `<h2>Name | PARTY</h2>` and follows it
 * with the statement and contact `<p>` blocks. We split on those headings and
 * keep the HTML between consecutive ones. The page's own chrome (site title,
 * etc.) also uses `<h2>`, but those headings have no `|` party separator, so the
 * name/party parse below rejects them.
 */
function splitSections(html: string): RawSection[] {
  const headingRe = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const matches: { heading: string; from: number; headingEnd: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(html)) !== null) {
    const heading = decodeEntities((m[1] ?? "").replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    matches.push({ heading, from: m.index, headingEnd: headingRe.lastIndex });
  }
  const sections: RawSection[] = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    if (!cur) continue;
    const end = matches[i + 1]?.from ?? html.length;
    sections.push({
      heading: cur.heading,
      body: html.slice(cur.headingEnd, end),
    });
  }
  return sections;
}

/** Parse "Name | PARTY" into its parts; null when there's no party separator. */
function parseHeading(heading: string): { name: string; party: string } | null {
  const idx = heading.indexOf("|");
  if (idx === -1) return null;
  const name = heading.slice(0, idx).trim();
  const party = heading.slice(idx + 1).trim();
  if (!name || !party) return null;
  return { name, party };
}

/**
 * The statement is the section's first paragraph(s) of prose. The LAST `<p>` is
 * typically the contact block (address / Tel / E-mail / social handles); we
 * detect and exclude it from the biography but mine it for contact fields.
 */
const CONTACT_MARKERS = /\b(tel|e-?mail|facebook|twitter|instagram|x:)\b/i;

function paragraphs(body: string): string[] {
  const out: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.push(m[1] ?? "");
  }
  return out;
}

/**
 * Find a candidate's photo by `alt` text across the whole page.
 *
 * Each candidate's `<img>` sits just BEFORE their heading (not inside the
 * section that follows it), so slicing by heading would grab the next
 * candidate's image. The `alt` attribute carries the candidate's name, so we
 * match on that instead of on position — robust against the markup ordering.
 */
function findPhotoByAlt(html: string, name: string): string | undefined {
  const imgRe = /<img[^>]+>/gi;
  let best: { src: string; score: number } | undefined;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    const tag = m[0];
    const altM = /\balt\s*=\s*["']([^"']*)["']/i.exec(tag);
    const srcM = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag);
    const alt = altM?.[1] && decodeEntities(altM[1]).trim();
    const src = srcM?.[1];
    if (!alt || !src) continue;
    const score = candidateNameSimilarity(
      dropInitials(name),
      dropInitials(alt),
    );
    if (score >= NAME_MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { src, score };
    }
  }
  const src = best?.src;
  if (!src) return undefined;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return `${GUIDE_BASE}${src}`;
  return undefined;
}

/** Extract a mailto: email from the contact block, if present. */
function extractEmail(contactHtml: string): string | undefined {
  const m = /href\s*=\s*["']mailto:([^"'?]+)["']?/i.exec(contactHtml);
  return m?.[1]?.trim();
}

/** Extract a phone number following a "Tel:" label. */
function extractPhone(contactText: string): string | undefined {
  const m = /tel(?:ephone)?\s*:?\s*([+\d().\-\s]{7,})/i.exec(contactText);
  const raw = m?.[1]?.trim();
  if (!raw) return undefined;
  // Keep only if it has enough digits to be a real number.
  return (raw.match(/\d/g)?.length ?? 0) >= 7 ? raw : undefined;
}

/** Extract a campaign website mentioned in the statement (e.g. "KatiePorter.com"). */
function extractWebsite(text: string): string | undefined {
  const m =
    /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*\.(?:com|org|net|vote|us)(?:\/[^\s,]*)?)\b/i.exec(
      text,
    );
  let url = m?.[1];
  if (!url) return undefined;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

/**
 * Map social-handle lines in the contact block to Google-Civic-shaped channels.
 *
 * Handles appear in two forms in the guide:
 *   "Facebook: @KatiePorterCA"            → bare handle
 *   "Facebook: facebook.com/BettyYeeforCA" → URL; take the path segment
 * We normalize both to the trailing handle and drop a bare domain (no path),
 * which carries no real handle.
 */
function handleFrom(raw: string): string | undefined {
  let h = raw.trim().replace(/^@/, "");
  // "facebook.com/Name" / "https://x.com/Name" → "Name"
  const slash = h.lastIndexOf("/");
  if (h.includes(".") && slash !== -1) h = h.slice(slash + 1);
  // A bare domain with no path (e.g. "facebook.com") is not a handle.
  if (h.includes(".")) return undefined;
  h = h.replace(/[^A-Za-z0-9._-]/g, "");
  return h.length ? h : undefined;
}

function extractChannels(contactText: string): CandidateChannel[] | undefined {
  const channels: CandidateChannel[] = [];
  // Match each labeled line up to the next whitespace token after the value.
  const patterns: { type: string; re: RegExp }[] = [
    { type: "Facebook", re: /facebook\s*:?\s*(\S+)/i },
    { type: "Twitter", re: /(?:twitter|\bx)\s*:\s*(\S+)/i },
    { type: "Instagram", re: /instagram\s*:?\s*(\S+)/i },
  ];
  for (const { type, re } of patterns) {
    const m = re.exec(contactText);
    const id = m?.[1] && handleFrom(m[1]);
    if (id) channels.push({ type, id });
  }
  return channels.length ? channels : undefined;
}

/**
 * Enrich a candidate from the CA SOS Official Voter Information Guide.
 *
 * Returns the verbatim candidate statement (as `statement`) plus any contact
 * fields the guide lists, all attributed to the official SOS office page — or
 * `null` when the state isn't CA, the office isn't a statewide one in the guide,
 * the page can't be fetched, or no heading matches the candidate's name.
 */
export async function enrichCandidateFromCaSos(
  name: string,
  ctx: { office?: string; stateAbbrev?: string; electionYear: number },
): Promise<CandidateSourceData | null> {
  if (!name.trim()) return null;
  if (ctx.stateAbbrev && ctx.stateAbbrev.toUpperCase() !== "CA") return null;

  const slug = officeSlug(ctx.office);
  if (!slug) return null;

  const url = `${GUIDE_BASE}/candidates/${slug}-candidate-statements.htm`;
  const html = await fetchText(url);
  if (!html || html.length < 500) return null;

  // Find the section whose heading name best matches the candidate. Compare
  // with middle initials dropped so "Tony K. Thurmond" matches "Tony Thurmond".
  const queryName = dropInitials(name);
  let best: { section: RawSection; party: string; score: number } | null = null;
  for (const section of splitSections(html)) {
    const parsed = parseHeading(section.heading);
    if (!parsed) continue;
    const score = candidateNameSimilarity(queryName, dropInitials(parsed.name));
    if (score >= NAME_MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { section, party: parsed.party, score };
    }
  }
  if (!best) return null;

  const paras = paragraphs(best.section.body);
  if (paras.length === 0) return null;

  // Separate the contact paragraph (last one matching contact markers) from the
  // statement prose. Everything that isn't the contact block is the biography.
  const contactIdx = paras
    .map((p, i) => ({ p: htmlToText(p), i }))
    .filter(({ p }) => CONTACT_MARKERS.test(p))
    .map(({ i }) => i)
    .pop();

  const contactHtml = contactIdx !== undefined ? (paras[contactIdx] ?? "") : "";
  const contactText = htmlToText(contactHtml);

  const bioParas = paras.filter((_, i) => i !== contactIdx).map(htmlToText);
  const biography = clamp(bioParas.join("\n\n"), MAX_BIO_CHARS);
  if (!biography || biography.length < 40) return null;

  const data: CandidateSourceData = {
    tier: "state_sos",
    sourceName: SOURCE_NAME,
    sourceUrl: url,
    official: true,
    matchedName: parseHeading(best.section.heading)?.name,
    biography,
    photoUrl: findPhotoByAlt(html, name),
    website: extractWebsite(biography),
    email: extractEmail(contactHtml),
    phone: extractPhone(contactText),
    channels: extractChannels(contactText),
  };

  // Surface only if we actually captured a real statement — the biography gate
  // above already guarantees that, so the source always contributes here.
  return data;
}
