/** SPUR Bay Area voter-guide scraper. Static HTML, cached per election guide. */
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";
import {
  SPUR_ADDRESS_HASH,
  SPUR_ENDPOINT,
  SPUR_ROOT,
  parseSpurGuideLinks,
  parseSpurMeasurePage,
  spurCacheParams,
} from "@acme/api/lib/measure-sources/spur";
import type { SpurPayload } from "@acme/api/lib/measure-sources/spur";

import type { Scraper } from "../utils/types.js";
import { createLogger } from "../utils/log.js";
import { fetchWithRetry } from "../utils/fetch.js";
import {
  incrementExistingChanged,
  incrementExistingUnchanged,
  incrementNewEntries,
  incrementTotalProcessed,
  setExpectedTotal,
} from "../utils/db/metrics.js";

const logger = createLogger("spur-voter-guide");
const GUIDES = [{ year: 2026, month: 6 }] as const;
const POLITENESS_MS = 750;
const CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const USER_AGENT = "Mozilla/5.0 (compatible; BillionCivicData/1.0; +https://billion.app)";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string> {
  await sleep(POLITENESS_MS);
  const response = await fetchWithRetry(url, {
    headers: { Accept: "text/html", "User-Agent": USER_AGENT },
  });
  return response.text();
}

async function scrapeGuide(year: number, month: number): Promise<void> {
  const guideUrl = `${SPUR_ROOT}/voter-guide/${year}-${String(month).padStart(2, "0")}`;
  try {
    const links = parseSpurGuideLinks(await fetchHtml(guideUrl), year, month);
    if (links.length === 0) {
      logger.warn(`${year}-${month}: no measure links found; preserving cache.`);
      return;
    }

    const measures = [];
    for (const sourceUrl of links) {
      try {
        const measure = parseSpurMeasurePage(await fetchHtml(sourceUrl), sourceUrl);
        if (!measure) throw new Error("page did not contain the expected ballot-measure structure");
        measures.push(measure);
      } catch (error) {
        // A partial guide must never replace the last complete cached guide.
        logger.error(`${sourceUrl}: parse/fetch failed; preserving cache.`, error);
        return;
      }
    }
    measures.sort((a, b) =>
      a.jurisdiction.localeCompare(b.jurisdiction) ||
      a.measureCode.localeCompare(b.measureCode, undefined, { numeric: true }),
    );
    const payload: SpurPayload = { sourceVersion: 1, guideUrl, measures };
    const params = spurCacheParams(year, month);
    const [existing] = await db.select({ responseData: CivicApiCache.responseData })
      .from(CivicApiCache)
      .where(and(
        eq(CivicApiCache.addressHash, SPUR_ADDRESS_HASH),
        eq(CivicApiCache.endpoint, SPUR_ENDPOINT),
        eq(CivicApiCache.params, params),
      )).limit(1);
    if (existing && JSON.stringify(existing.responseData) === JSON.stringify(payload)) {
      incrementExistingUnchanged();
      logger.info(`${year}-${month}: unchanged (${measures.length} measures).`);
      return;
    }
    if (existing) incrementExistingChanged();
    else incrementNewEntries();
    const now = new Date();
    await db.insert(CivicApiCache).values({
      addressHash: SPUR_ADDRESS_HASH,
      endpoint: SPUR_ENDPOINT,
      params,
      responseData: payload,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
    }).onConflictDoUpdate({
      target: [CivicApiCache.addressHash, CivicApiCache.endpoint, CivicApiCache.params],
      set: { responseData: payload, fetchedAt: now, expiresAt: new Date(now.getTime() + CACHE_TTL_MS) },
    });
    logger.success(`${year}-${month}: cached ${measures.length} SPUR analyses.`);
  } catch (error) {
    logger.error(`${year}-${month}: guide scrape failed.`, error);
  } finally {
    incrementTotalProcessed();
  }
}

async function scrape(): Promise<void> {
  setExpectedTotal(GUIDES.length);
  for (const guide of GUIDES) await scrapeGuide(guide.year, guide.month);
}

export const spurVoterGuide: Scraper = { name: "spur-voter-guide", scrape };
