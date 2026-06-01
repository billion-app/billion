/**
 * Grounding-text collector for the AI fallback.
 *
 * When no human/official/aggregator source covered a measure, we still try to
 * point the voter at real reading material rather than show a blank card — but
 * we NEVER let the AI summarize from a bare title. This module fetches real
 * text from clean, server-rendered sources and returns it (with the URLs it
 * came from) so the AI summary is grounded and auditable.
 *
 * Primary source: SPUR's Bay Area voter guide — static HTML, with a per-election
 * index we can resolve a measure against by its letter (the same
 * index-then-article pattern the Ballotpedia adapter uses). SPUR is
 * party-independent but NOT neutral: it issues an explicit YES/NO endorsement on
 * every measure, so we strip its recommendation section before grounding (see
 * stripRecommendation) and treat what remains as descriptive context only. If
 * nothing substantive is found, returns null and the card stays empty.
 */

import { parseMeasureCodes } from "./ballotpedia";
import { fetchText } from "./fetch";
import { htmlToText } from "./html";

const MIN_TEXT = 250;
const SPUR_NAME = "SPUR Voter Guide";

/**
 * Marks the start of SPUR's explicit YES/NO endorsement ("SPUR's
 * Recommendation"). SPUR is party-independent but NOT neutral — it advocates a
 * position on every measure. We use this boundary to keep that advocacy out of
 * both the pro/con extraction and the text we ground the neutral AI summary on.
 */
const RECOMMENDATION_RE = /\bspur.?s?\s+recommendation\b/i;

/** Drop SPUR's recommendation section onward, so only descriptive text remains. */
function stripRecommendation(text: string): string {
  const m = RECOMMENDATION_RE.exec(text);
  return m ? text.slice(0, m.index).trimEnd() : text;
}

export interface GroundingResult {
  text: string;
  sources: { name: string; url: string }[];
  /** Real, human-written pro/con bullets parsed from the source, if any. */
  pros?: string[];
  cons?: string[];
}

/**
 * Extract SPUR's "Pros" and "Cons" bullet lists from the page's plaintext.
 * SPUR lays them out as a "Pros" heading, a few sentences, then "Cons", then
 * "SPUR's Recommendation". We slice between those markers and split sentences.
 */
function extractSpurProsCons(text: string): {
  pros: string[];
  cons: string[];
} {
  const slice = (start: RegExp, stops: RegExp[]): string | undefined => {
    const m = start.exec(text);
    if (!m) return undefined;
    const from = m.index + m[0].length;
    let to = text.length;
    for (const stop of stops) {
      const sm = stop.exec(text.slice(from));
      if (sm && from + sm.index < to) to = from + sm.index;
    }
    const out = text.slice(from, to).trim();
    return out.length >= 20 ? out : undefined;
  };

  const toBullets = (block: string | undefined): string[] => {
    if (!block) return [];
    return block
      .split(/\n+/)
      .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z])/))
      .map((s) => s.trim())
      .filter((s) => s.length >= 25)
      .slice(0, 4);
  };

  const proRe = /\bpros\b/i;
  const conRe = /\bcons\b/i;
  return {
    pros: toBullets(slice(proRe, [conRe, RECOMMENDATION_RE])),
    cons: toBullets(slice(conRe, [RECOMMENDATION_RE])),
  };
}

/**
 * SPUR guides live at /voter-guide/<YYYY>-<MM>; try the common election months
 * for the year. Within each, resolve the measure article by its letter.
 */
async function resolveSpurArticle(
  title: string,
  year: number,
): Promise<{
  url: string;
  text: string;
  pros: string[];
  cons: string[];
} | null> {
  const codes = parseMeasureCodes(title).map((c) => c.toLowerCase());
  if (!codes.length) return null;

  for (const mm of ["06", "11", "03"]) {
    const indexUrl = `https://www.spur.org/voter-guide/${year}-${mm}`;
    const indexHtml = await fetchText(indexUrl);
    if (!indexHtml) continue;

    const base = `/voter-guide/${year}-${mm}/`;
    const allLinks = [
      ...indexHtml.matchAll(
        /href="(\/voter-guide\/[0-9]{4}-[0-9]{2}\/[^"#]+)"/gi,
      ),
    ]
      .map((m) => m[1])
      .filter((h): h is string => !!h && h.startsWith(base));

    for (const code of codes) {
      const links = allLinks.filter((h) =>
        new RegExp(`measure-${code}\\b`, "i").test(h),
      );
      for (const href of [...new Set(links)].slice(0, 3)) {
        const html = await fetchText(`https://www.spur.org${href}`);
        if (!html) continue;
        const text = htmlToText(html);
        if (text.length >= MIN_TEXT) {
          const { pros, cons } = extractSpurProsCons(text);
          // Ground the AI summary on SPUR's *descriptive* text only — strip the
          // endorsement section so its YES/NO recommendation never leaks into
          // the supposedly neutral summary.
          return {
            url: `https://www.spur.org${href}`,
            text: stripRecommendation(text).slice(0, 4000),
            pros,
            cons,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Attempt to collect groundable source text for a measure. Returns null when no
 * source yields enough real text to responsibly summarize.
 */
export async function collectGroundingText(
  title: string,
  ctx: { electionYear: number; county?: string },
): Promise<GroundingResult | null> {
  const spur = await resolveSpurArticle(title, ctx.electionYear).catch(
    () => null,
  );
  if (spur) {
    return {
      text: `From ${SPUR_NAME} (${spur.url}):\n${spur.text}`,
      sources: [{ name: SPUR_NAME, url: spur.url }],
      pros: spur.pros.length ? spur.pros : undefined,
      cons: spur.cons.length ? spur.cons : undefined,
    };
  }
  return null;
}
