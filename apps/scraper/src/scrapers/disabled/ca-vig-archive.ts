/**
 * California SOS Voter Information Guide *archive* scraper.
 *
 * Walks https://vigarchive.sos.ca.gov — the historical VIG (statewide
 * propositions, 1996–present) — and writes one CivicApiCache row per election
 * (year + election-type), each holding every parsed proposition for that
 * election. The measure cross-validation engine reads these rows back at request
 * time keyed by year + proposition number, so the page fetch + HTML parse stays
 * out of the serverless API path (same handoff pattern as ca-sos-statements).
 *
 * Why the archive and not the live guide: voterguide.sos.ca.gov 403s automated
 * clients, but vigarchive.sos.ca.gov serves the same official content and is
 * scrapable with a browser User-Agent. All parsing lives in the pure
 * @acme/api/lib/measure-sources/vig-archive module; this file only fetches,
 * orchestrates, throttles, and persists.
 *
 * Cadence: the archive is historical and effectively immutable once an election
 * passes, so this is a low-frequency backfill — re-runs upsert idempotently.
 */

import type {
  VigArchivePayload,
  VigArchiveProp,
  VigElection,
} from "@acme/api/lib/measure-sources/disabled/vig-archive";
import {
  argsRebuttalsUrl,
  parseArchiveIndex,
  parseArgsRebuttals,
  parsePropIndex,
  parsePropPage,
  propPageUrl,
  propsIndexUrl,
  VIG_ARCHIVE_ADDRESS_HASH,
  VIG_ARCHIVE_ENDPOINT,
  VIG_ARCHIVE_ROOT,
  vigArchiveCacheParams,
} from "@acme/api/lib/measure-sources/disabled/vig-archive";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type { Scraper } from "../../utils/types.js";
import { fetchWithRetry } from "../../utils/fetch.js";
import { createLogger } from "../../utils/log.js";

const logger = createLogger("ca-vig-archive");

/** Archive content is historical/immutable; keep cache rows for a year. */
const CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/** Politeness delay between requests to a government archive host. */
const POLITENESS_MS = 750;

/** Some archive pages WAF-filter bare clients; send a real browser UA. */
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Defensive HTML GET — non-200 / network error yields null, never a throw. */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(url, {
      headers: { Accept: "text/html", "User-Agent": BROWSER_UA },
    });
    return await res.text();
  } catch (err) {
    logger.warn(`fetch failed: ${url}`, err);
    return null;
  }
}

/** Fetch + parse every proposition for one election. */
async function scrapeElection(el: VigElection): Promise<VigArchiveProp[]> {
  const indexHtml = await fetchHtml(propsIndexUrl(el));
  if (!indexHtml) {
    logger.warn(`${el.path}: no propositions index — skipping.`);
    return [];
  }

  const numbers = parsePropIndex(indexHtml);
  if (numbers.length === 0) {
    logger.info(`${el.path}: index had no propositions.`);
    return [];
  }

  const props: VigArchiveProp[] = [];
  for (const propNumber of numbers) {
    await sleep(POLITENESS_MS);
    const pageHtml = await fetchHtml(propPageUrl(el, propNumber));
    if (!pageHtml) continue;
    const page = parsePropPage(pageHtml);
    if (!page) {
      logger.warn(`${el.path}prop ${propNumber}: page parse yielded nothing.`);
      continue;
    }

    // Full arguments + rebuttals live on a sibling page; absence is tolerated.
    await sleep(POLITENESS_MS);
    const argsHtml = await fetchHtml(argsRebuttalsUrl(el, propNumber));
    const args = argsHtml ? parseArgsRebuttals(argsHtml) : {};

    props.push({
      year: el.year,
      electionType: el.electionType,
      sourceUrl: propPageUrl(el, propNumber),
      ...page,
      ...args,
    });
  }

  logger.info(
    `${el.path}: parsed ${props.length}/${numbers.length} propositions.`,
  );
  return props;
}

/** Upsert one election's propositions into a single CivicApiCache row. */
async function writeElection(
  el: VigElection,
  props: VigArchiveProp[],
): Promise<void> {
  const payload: VigArchivePayload = { props };
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
  const params = vigArchiveCacheParams(el.year, el.electionType);

  try {
    await db
      .insert(CivicApiCache)
      .values({
        addressHash: VIG_ARCHIVE_ADDRESS_HASH,
        endpoint: VIG_ARCHIVE_ENDPOINT,
        params,
        responseData: payload,
        fetchedAt: now,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          CivicApiCache.addressHash,
          CivicApiCache.endpoint,
          CivicApiCache.params,
        ],
        set: { responseData: payload, fetchedAt: now, expiresAt },
      });
    logger.success(`${el.path}: cached ${props.length} propositions.`);
  } catch (err) {
    logger.error(`${el.path}: cache write failed:`, err);
  }
}

async function scrape(): Promise<void> {
  logger.info("Scraping CA VIG archive…");

  const rootHtml = await fetchHtml(`${VIG_ARCHIVE_ROOT}/`);
  if (!rootHtml) {
    logger.error("Could not fetch archive root — aborting.");
    return;
  }

  const elections = parseArchiveIndex(rootHtml);
  logger.info(`Found ${elections.length} elections in the archive index.`);

  let total = 0;
  for (const el of elections) {
    const props = await scrapeElection(el);
    if (props.length > 0) {
      await writeElection(el, props);
      total += props.length;
    }
  }

  logger.success(
    `CA VIG archive: cached ${total} propositions across ${elections.length} elections.`,
  );
}

export const caVigArchive: Scraper = {
  id: "ca-vig-archive",
  name: "ca-vig-archive",
  source: "California Secretary of State voter-guide archive",
  environment: { required: ["POSTGRES_URL"] },
  scrape,
};
