/**
 * California Legislative Analyst's Office (LAO) ballot analysis scraper.
 *
 * Fetches the LAO's fiscal analyses for California ballot propositions for the
 * current election year and writes one CivicApiCache row per proposition. The
 * API measure-source adapter reads those rows at request time without a live
 * HTTP call during a user request.
 *
 * Source: https://lao.ca.gov/BallotAnalysis/Propositions
 * Discovery: fetch the index page, filter by the current year, extract
 * proposition numbers from the card links, then fetch each individual analysis.
 *
 * Cadence: run in the ~90-day window before a general election. Re-runs upsert.
 */

import * as cheerio from "cheerio";

import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type { Scraper } from "../../utils/types.js";
import { getItemLimit } from "../../utils/concurrency.js";
import {
  incrementTotalProcessed,
  setExpectedTotal,
} from "../../utils/db/metrics.js";
import { fetchWithRetry } from "../../utils/fetch.js";
import { createLogger } from "../../utils/log.js";

const logger = createLogger("ca-lao-fiscal");

const LAO_BASE = "https://lao.ca.gov";
const LAO_INDEX = `${LAO_BASE}/BallotAnalysis/Propositions`;

/** Constant addressHash — identifies all LAO fiscal rows in the cache. */
const CA_LAO_ADDRESS_HASH = "ca-lao-fiscal";
/** Endpoint label stored in the cache row. */
const CA_LAO_ENDPOINT = "ca-lao-fiscal";

/** Cache rows expire after 30 days; re-runs upsert. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Browser-like UA to avoid being blocked by the LAO CMS. */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface LaoPropositionAnalysis {
  propNumber: number;
  year: number;
  title: string;
  yesNoSummary: string | null;
  background: string | null;
  proposal: string | null;
  fiscalEffects: string | null;
  ballotLabel: string | null;
  url: string;
}

/** Build the params JSON used as the composite cache key. */
function laoCacheParams(propNumber: number, year: number): string {
  return JSON.stringify({ propNumber, year });
}

/**
 * Fetch the LAO index page filtered by a given election date string and return
 * all {number, year} pairs found. Falls back gracefully on fetch failure.
 */
async function discoverPropositions(
  year: number,
): Promise<Array<{ number: number; year: number }>> {
  // The index page accepts a date filter via GET param matching the select options.
  // We fetch all elections and filter client-side by year to avoid exact date matching.
  let html: string;
  try {
    const res = await fetchWithRetry(LAO_INDEX, {
      headers: { "User-Agent": USER_AGENT },
    });
    html = await res.text();
  } catch (err) {
    logger.warn("LAO index fetch failed:", err);
    return [];
  }

  const $ = cheerio.load(html);
  const props: Array<{ number: number; year: number }> = [];

  // Each proposition card has an HTML link: /BallotAnalysis/Proposition?number=N&year=YYYY
  $('a.card-link[href*="Proposition?number="]').each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/number=(\d+)&year=(\d{4})/);
    if (!match) return;
    const propNum = parseInt(match[1]!, 10);
    const propYear = parseInt(match[2]!, 10);
    if (propYear === year) {
      props.push({ number: propNum, year: propYear });
    }
  });

  // Deduplicate by prop number (same link may appear twice in some layouts)
  const seen = new Set<number>();
  return props.filter(({ number: n }) => {
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}

/**
 * Extract text content of all sibling elements between a heading and the next
 * heading. Returns null if the section heading is not found.
 */
function extractSection(
  $: ReturnType<typeof cheerio.load>,
  container: ReturnType<ReturnType<typeof cheerio.load>>,
  headingSelector: string,
  matcher: RegExp,
): string | null {
  let targetEl: ReturnType<typeof $> | null = null;
  container.find(headingSelector).each((_i, el) => {
    if (matcher.test($(el).text().trim())) {
      targetEl = $(el);
      return false; // break
    }
  });

  if (!targetEl) return null;

  const parts: string[] = [];
  // Stop at the next heading of any level — avoids leaking sibling sections.
  let $current = (targetEl as ReturnType<typeof $>).next();
  while ($current.length > 0) {
    const tagName = ($current[0] as { tagName?: string }).tagName ?? "";
    if (/^h[1-6]$/i.test(tagName)) break;
    const text = $current.text().trim();
    if (text) parts.push(text);
    $current = $current.next();
  }

  const result = parts.join("\n\n").trim();
  return result || null;
}

/**
 * Fetch and parse a single LAO proposition analysis page.
 * Returns null on fetch/parse failure.
 */
async function fetchPropositionAnalysis(
  propNumber: number,
  year: number,
): Promise<LaoPropositionAnalysis | null> {
  const url = `${LAO_BASE}/BallotAnalysis/Proposition?number=${propNumber}&year=${year}`;

  let html: string;
  try {
    // maxRetries: 0 — HTTP 500 is expected for non-existent prop/year combos
    // (probe mode). Retrying would add 7s of backoff per invalid number.
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": USER_AGENT },
      maxRetries: 0,
    });
    html = await res.text();
  } catch {
    return null;
  }

  const $ = cheerio.load(html);

  // Title — h1 inside div.report-body is the full title
  const reportBody = $("div.report-body");
  if (reportBody.length === 0) {
    logger.warn(`Prop ${propNumber}/${year}: no div.report-body found`);
    return null;
  }

  const title =
    reportBody.find("h1").first().text().trim() ||
    reportBody.find("h2").first().text().trim() ||
    `Proposition ${propNumber}`;

  // Yes/No summary from meta description tag (most reliable extraction path)
  const yesNoSummary =
    $('meta[name="description"]').attr("content")?.trim() ?? null;

  // Section extraction — all key sections use .text-uppercase class
  const background = extractSection(
    $,
    reportBody,
    "h4.text-uppercase",
    /^background$/i,
  );

  const proposal = extractSection(
    $,
    reportBody,
    "h4.text-uppercase",
    /^proposal$/i,
  );

  const fiscalEffects = extractSection(
    $,
    reportBody,
    "h4.text-uppercase",
    /fiscal effects?/i,
  );

  const ballotLabel = extractSection(
    $,
    reportBody,
    "h3.text-uppercase",
    /^ballot label$/i,
  );

  return {
    propNumber,
    year,
    title,
    yesNoSummary,
    background,
    proposal,
    fiscalEffects,
    ballotLabel,
    url,
  };
}

async function scrape(): Promise<void> {
  const year = new Date().getFullYear();
  logger.info(`Scraping CA LAO fiscal analyses for ${year}…`);

  // Discover all propositions on the index for the current year
  let props = await discoverPropositions(year);

  if (props.length === 0) {
    // Fall back to probing numbers 1–35 if the index yielded nothing
    logger.info(
      `No propositions found on index for ${year} — probing numbers 1–35`,
    );
    props = Array.from({ length: 35 }, (_, i) => ({
      number: i + 1,
      year,
    }));
  }

  logger.info(`Found ${props.length} proposition(s) to process for ${year}`);
  setExpectedTotal(props.length);

  const limit = getItemLimit();
  await Promise.allSettled(
    props.map(({ number: propNumber }) =>
      limit(async () => {
        try {
          const analysis = await fetchPropositionAnalysis(propNumber, year);
          if (!analysis) {
            // HTTP 500 is expected for invalid prop/year combos (probe mode)
            return;
          }

          const now = new Date();
          const params = laoCacheParams(propNumber, year);

          await db
            .insert(CivicApiCache)
            .values({
              addressHash: CA_LAO_ADDRESS_HASH,
              endpoint: CA_LAO_ENDPOINT,
              params,
              responseData: analysis as unknown as Record<string, unknown>,
              fetchedAt: now,
              expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
            })
            .onConflictDoUpdate({
              target: [
                CivicApiCache.addressHash,
                CivicApiCache.endpoint,
                CivicApiCache.params,
              ],
              set: {
                responseData: analysis as unknown as Record<string, unknown>,
                fetchedAt: now,
                expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
              },
            });

          logger.success(
            `Prop ${propNumber}/${year}: cached "${analysis.title}"`,
          );
        } catch (err) {
          logger.error(`Prop ${propNumber}/${year}: cache write failed:`, err);
        } finally {
          incrementTotalProcessed();
        }
      }),
    ),
  );

  logger.info(`CA LAO ${year}: scrape complete.`);
}

export const caLaoFiscal: Scraper = {
  name: "ca-lao-fiscal",
  scrape,
};
