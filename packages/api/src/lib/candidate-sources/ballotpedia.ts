/**
 * Ballotpedia adapter — biographical data for individual candidates.
 *
 * Ballotpedia has a public, rendered article for most candidates who have run
 * for office. There is no free JSON API (the MediaWiki api.php is disabled), so
 * we scrape the public article HTML — exactly like the measure adapter. A
 * realistic browser User-Agent is required or the CloudFront WAF returns a
 * 202/403 challenge (see ../measure-sources/fetch.ts).
 *
 * Unlike measures, a candidate article title CAN be constructed directly from
 * the name (Ballotpedia slugifies "John Smith" → "John_Smith"), so we fetch the
 * page directly rather than resolving through an index. The risk is collisions:
 * a bare name may resolve to a disambiguation page or an unrelated person. We
 * defend against that with a PERSON-VS-DISAMBIGUATION guard:
 *   - reject obvious disambiguation pages (title/markers say "disambiguation")
 *   - require a biographical lead ("... is a/was a/is an American ...")
 *   - require political context: either a known biography/career section anchor,
 *     or election/office/politics keywords in the lead text.
 *
 * Every surfaced field is attributed back to the Ballotpedia article URL.
 *
 * There is no API key for Ballotpedia (it is a public scrape). The adapter is
 * still strictly best-effort: any fetch/parse failure yields `null`, never a
 * throw, so it composes with the other candidate sources via Promise.all.
 */

import type { CandidateSourceData } from "./types";
import { fetchText } from "../measure-sources/fetch";
import { extractByAttr, htmlToText } from "../measure-sources/html";

const SOURCE_NAME = "Ballotpedia";
const BASE = "https://ballotpedia.org";

/** Map two-letter state abbreviations to full names for contest corroboration. */
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming", DC: "District of Columbia",
};

/**
 * Derive office/role keywords from a contest office string ("Member, State
 * Assembly", "Mayor", "Board of Supervisors") for contest corroboration. We
 * keep alphabetic tokens of length >= 4 so "Mayor"/"Assembly"/"Senate" survive
 * but generic glue ("of", "the", "for") does not.
 */
function officeKeywords(office: string | undefined): string[] {
  if (!office) return [];
  return office
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4);
}

/** Section anchors (Ballotpedia `mw-headline` ids) that mark a real person. */
const BIO_ANCHORS = [
  "Biography",
  "Political_career",
  "Career",
  "Elections",
  "Campaign_themes",
  "Education",
];

/** Anchors that bound the biographical lead/section we extract. */
const STOP_ANCHORS = [
  "See_also",
  "External_links",
  "References",
  "Recent_news",
  "Footnotes",
  "Contact_information",
  "Campaign_finance",
];

/** Keywords proving the lead is about a political figure (anti-collision). */
const POLITICAL_RE =
  /\b(elect(?:ed|ion|ions)?|candidate|incumbent|politician|senat\w*|assembl\w*|congress\w*|representative|governor|mayor|council\w*|supervisor|legislat\w*|democrat\w*|republican\w*|office|ballot|district|board of)\b/i;

/** Markers that a page is a disambiguation hub, not a person. */
const DISAMBIG_RE =
  /\b(may refer to|disambiguation|is a list of|multiple people)\b/i;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Slugify a candidate name to Ballotpedia's title convention:
 * spaces → underscores, collapse internal whitespace, keep letters/.'- intact.
 * We try a couple of variants because Ballotpedia titles vary in suffix usage.
 */
function nameSlugs(name: string): string[] {
  const clean = name
    .replace(/\s+/g, " ")
    .replace(/[“”"]/g, "")
    .trim();
  if (!clean) return [];
  const base = clean.replace(/ /g, "_");
  const slugs = [base];
  // Drop a trailing suffix ("Jr.", "Sr.", "III") which Ballotpedia often omits.
  const noSuffix = clean.replace(/[\s,]+(?:jr\.?|sr\.?|i{2,3}|iv)$/i, "").trim();
  if (noSuffix && noSuffix !== clean) slugs.push(noSuffix.replace(/ /g, "_"));
  return [...new Set(slugs)];
}

/**
 * Extract the plaintext between a section heading and the next heading.
 * Ballotpedia wraps headings as `<span class="mw-headline" id="...">`.
 * (Same helper shape as the measure adapter's `sectionByAnchors`.)
 */
function sectionByAnchors(
  html: string,
  ids: string[],
  stopIds: string[],
): string | undefined {
  const anchor = (id: string) =>
    new RegExp(`<span[^>]*class="mw-headline"[^>]*id="${escapeRe(id)}"`, "i");
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

/** Does the HTML contain any of the given `mw-headline` section anchors? */
function hasAnchor(html: string, ids: string[]): boolean {
  return ids.some((id) =>
    new RegExp(
      `<span[^>]*class="mw-headline"[^>]*id="${escapeRe(id)}"`,
      "i",
    ).test(html),
  );
}

function clamp(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const t = s
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

/**
 * Extract the biographical lead — the prose before the first section heading.
 * Strips Ballotpedia's edit/infobox noise and ref markers, then keeps text up
 * to the first `<span class="mw-headline">`.
 */
function leadText(html: string): string | undefined {
  // Prefer the parser-output body; fall back to the whole doc.
  const body = extractByAttr(html, "class", "mw-parser-output") ?? html;
  const firstHeadlineIdx = /<span[^>]*class="mw-headline"/i.exec(body)?.index;
  const slice =
    firstHeadlineIdx !== undefined ? body.slice(0, firstHeadlineIdx) : body;
  const text = htmlToText(slice)
    // Drop bracketed ref markers and stray leading whitespace.
    .replace(/\[\d+\]/g, "")
    .replace(/\[edit\]/gi, "")
    .trim();
  return text.length >= 40 ? text : undefined;
}

/**
 * Pull a candidate photo URL out of the infobox. Ballotpedia renders the photo
 * as an <img> inside the candidate infobox; the `src` is an absolute upload URL
 * (or a protocol-relative `//` URL we normalize to https).
 */
function infoboxPhoto(html: string): string | undefined {
  const infobox =
    extractByAttr(html, "class", "infobox") ??
    extractByAttr(html, "class", "widget-row") ??
    html;
  // First reasonable <img> inside the infobox region.
  const m = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i.exec(infobox);
  let src = m?.[1];
  if (!src) return undefined;
  if (src.startsWith("//")) src = "https:" + src;
  if (src.startsWith("/")) src = BASE + src;
  if (!/^https?:\/\//i.test(src)) return undefined;
  // Skip sprites / icons / data URIs that are clearly not portraits.
  if (/\.svg(?:$|\?)/i.test(src)) return undefined;
  if (!/\.(?:jpe?g|png|webp)(?:$|\?)/i.test(src)) return undefined;
  return src;
}

/**
 * Pull the candidate's campaign website. Ballotpedia infoboxes link it as an
 * external "Campaign website" / "Official website" row. Best-effort: take the
 * first external (non-ballotpedia, non-wikipedia) http link in the infobox.
 */
function infoboxWebsite(html: string): string | undefined {
  const infobox =
    extractByAttr(html, "class", "infobox") ??
    extractByAttr(html, "class", "widget-row") ??
    "";
  const linkRe = /<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(infobox))) {
    const url = m[1];
    if (!url) continue;
    if (/ballotpedia\.org|wikipedia\.org|wikimedia\.org/i.test(url)) continue;
    if (/facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|linkedin\.com/i.test(url))
      continue;
    return url;
  }
  return undefined;
}

/**
 * Verify a fetched page is really a candidate's biography, not a disambiguation
 * page, an unrelated person, OR a same-name politician from another contest.
 * Returns the trustworthy biography text (plus the raw prose it derived from,
 * for AI grounding) or null.
 *
 * Beyond the person/disambiguation/political gates, this performs a HARD
 * contest-corroboration check: the article text must mention at least one of
 * the contest's state name, office/role keyword, or election year (or year-1).
 * A page that only proves "is some politician" with no contest token is
 * REJECTED — this is the primary defense against wrong same-name matches.
 */
function verifyPersonArticle(
  html: string,
  name: string,
  ctx: {
    office?: string;
    county?: string;
    stateAbbrev?: string;
    electionYear: number;
  },
): { biography: string } | null {
  if (DISAMBIG_RE.test(html.slice(0, 4000))) return null;

  const lead = leadText(html);
  // A real biographical lead reads "<Name> ... is a/was a/is an American ...".
  const hasBioLead =
    !!lead && /\b(is|was)\s+(?:a|an|the)\b/i.test(lead.slice(0, 400));
  const hasCareerSection = hasAnchor(html, BIO_ANCHORS);
  const politicalLead = !!lead && POLITICAL_RE.test(lead);

  // Require a biographical lead, AND political context from EITHER a known
  // career/biography section OR political keywords in the lead. This keeps out
  // same-name non-politicians while tolerating sparse stub pages.
  if (!hasBioLead) return null;
  if (!hasCareerSection && !politicalLead) return null;

  // Prefer the dedicated Biography section prose; fall back to the lead.
  const section = sectionByAnchors(html, BIO_ANCHORS, STOP_ANCHORS);
  const biography = clamp(section ?? lead, 600);
  if (!biography || biography.length < 40) return null;
  // Sanity: the article should at least mention a name token, guarding against
  // a redirect landing on an entirely unrelated topic. Strip a trailing suffix
  // ("Jr."/"III"/...) — reuse the nameSlugs suffix regex — so "Maria Lopez Jr."
  // checks "lopez", not "jr.".
  const nameNoSuffix = name
    .trim()
    .replace(/[\s,]+(?:jr\.?|sr\.?|i{2,3}|iv)$/i, "")
    .trim();
  const surname = nameNoSuffix.split(/\s+/).pop()?.toLowerCase();
  if (surname && surname.length > 2 && !biography.toLowerCase().includes(surname))
    return null;

  // HARD contest corroboration: reject "some politician" with no contest token.
  // Match against the full article (lead + infobox + sections), lowercased.
  const haystack = htmlToText(html).toLowerCase();
  const stateName = ctx.stateAbbrev
    ? STATE_NAMES[ctx.stateAbbrev.toUpperCase()]
    : undefined;
  const stateOk = !!stateName && haystack.includes(stateName.toLowerCase());
  const officeOk = officeKeywords(ctx.office).some((k) => haystack.includes(k));
  const yearOk =
    haystack.includes(String(ctx.electionYear)) ||
    haystack.includes(String(ctx.electionYear - 1));
  if (!stateOk && !officeOk && !yearOk) return null;

  return { biography };
}

/**
 * Resolve and scrape the Ballotpedia article for a candidate.
 *
 * @param name Candidate name from Google Civic.
 * @param ctx  Contest context (office/county/state/year) — used as a HARD
 *             verification that the resolved article is THIS candidate's, not a
 *             same-name politician from another contest.
 * @returns CandidateSourceData (tier "ballotpedia") or null when no confident
 *          person article is found.
 */
export async function enrichCandidateFromBallotpedia(
  name: string,
  ctx: {
    office?: string;
    county?: string;
    stateAbbrev?: string;
    electionYear: number;
  },
): Promise<CandidateSourceData | null> {
  const slugs = nameSlugs(name);
  if (!slugs.length) return null;

  for (const slug of slugs) {
    const url = `${BASE}/${encodeURIComponent(slug)}`;
    const html = await fetchText(url);
    if (!html || html.length < 1000) continue;

    const verified = verifyPersonArticle(html, name, ctx);
    if (!verified) continue;

    const photoUrl = infoboxPhoto(html);
    const website = infoboxWebsite(html);

    return {
      tier: "ballotpedia",
      sourceName: SOURCE_NAME,
      sourceUrl: url,
      official: false,
      matchedName: name,
      biography: verified.biography,
      photoUrl,
      website,
    };
  }

  return null;
}
