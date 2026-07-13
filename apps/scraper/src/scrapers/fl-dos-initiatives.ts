/**
 * Florida DOS constitutional initiatives scraper (source shape v1).
 *
 * Live access is permission-gated with FL_DOS_SCRAPING_ENABLED=1. It queries
 * the official server-rendered database, enriches every row from its detail
 * page, extracts text-layer PDFs, and caches one complete payload per year.
 */
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";
import { extractText } from "unpdf";

import {
  FL_DOS_ADDRESS_HASH,
  FL_DOS_ENDPOINT,
  FL_DOS_ROOT,
  flDosCacheParams,
  parseFlDosDetail,
  parseFlDosSearchResults,
  parseFlDosYears,
  sortFlDosInitiatives,
} from "@acme/api/lib/measure-sources/fl-dos-initiatives";
import type {
  FlDosInitiative,
  FlDosPayload,
  FlDosSearchResult,
} from "@acme/api/lib/measure-sources/fl-dos-initiatives";

import type { Scraper } from "../utils/types.js";
import { createLogger } from "../utils/log.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { getItemLimit } from "../utils/concurrency.js";
import {
  incrementExistingChanged,
  incrementExistingUnchanged,
  incrementNewEntries,
  incrementTotalProcessed,
  setExpectedTotal,
} from "../utils/db/metrics.js";

const logger = createLogger("fl-dos-initiatives");
const MIN_YEAR = 2026;
const POLITENESS_MS = 900;
const CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; BillionCivicData/1.0; +https://billion.app)";
const HTML_HEADERS = { Accept: "text/html", "User-Agent": USER_AGENT };

function enabled(): boolean {
  return /^(1|true|yes)$/i.test(process.env.FL_DOS_SCRAPING_ENABLED ?? "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

/** Serialize request starts so configured concurrency cannot create a burst. */
async function throttle(): Promise<void> {
  const turn = requestQueue.then(async () => {
    const wait = Math.max(0, POLITENESS_MS - (Date.now() - lastRequestAt));
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
  });
  requestQueue = turn.catch(() => undefined);
  await turn;
}

async function fetchHtml(url: string, init: RequestInit = {}): Promise<string> {
  await throttle();
  const response = await fetchWithRetry(url, {
    ...init,
    headers: { ...HTML_HEADERS, ...(init.headers as Record<string, string> | undefined) },
  });
  return response.text();
}

async function fetchYear(year: number): Promise<FlDosSearchResult[]> {
  const body = new URLSearchParams({
    Year: String(year),
    Status: "ALL",
    MadeBallot: "",
    Title: "",
    Sponsor: "ALL",
  });
  const html = await fetchHtml(`${FL_DOS_ROOT}/`, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return parseFlDosSearchResults(html).filter((item) => item.electionYear === year);
}

async function extractPdfText(url: string): Promise<string | undefined> {
  try {
    await throttle();
    const response = await fetchWithRetry(url, {
      headers: { Accept: "application/pdf", "User-Agent": USER_AGENT },
      timeoutMs: 45_000,
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!/pdf/i.test(contentType)) {
      logger.warn(`Full-text link did not return a PDF: ${url}`);
      return undefined;
    }
    const { text } = await extractText(new Uint8Array(await response.arrayBuffer()));
    const normalized = text
      .join("\n\n")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return normalized.length >= 40 ? normalized : undefined;
  } catch (error) {
    logger.warn(`PDF extraction failed for ${url}:`, error);
    return undefined;
  }
}

async function existingPayload(year: number): Promise<FlDosPayload | null> {
  const [row] = await db
    .select({ responseData: CivicApiCache.responseData })
    .from(CivicApiCache)
    .where(and(
      eq(CivicApiCache.addressHash, FL_DOS_ADDRESS_HASH),
      eq(CivicApiCache.endpoint, FL_DOS_ENDPOINT),
      eq(CivicApiCache.params, flDosCacheParams(year)),
    ))
    .limit(1);
  return row ? (row.responseData as FlDosPayload) : null;
}

async function enrichResult(
  result: FlDosSearchResult,
  prior: FlDosInitiative | undefined,
): Promise<FlDosInitiative> {
  const detail = parseFlDosDetail(await fetchHtml(result.detailUrl), result);
  if (!detail.fullTextUrl) return detail;

  // Reuse extracted text while the official PDF URL is unchanged.
  if (prior?.fullTextUrl === detail.fullTextUrl && prior.fullText) {
    return { ...detail, fullText: prior.fullText };
  }
  return { ...detail, fullText: await extractPdfText(detail.fullTextUrl) };
}

async function scrapeYear(year: number): Promise<void> {
  try {
    const discovered = await fetchYear(year);
    if (discovered.length === 0) {
      logger.warn(`${year}: query returned no initiatives; preserving any cached payload.`);
      return;
    }

    const prior = await existingPayload(year);
    const priorByKey = new Map(
      (prior?.initiatives ?? []).map((item) => [`${item.account}:${item.seqnum}`, item]),
    );
    const limit = getItemLimit();
    const settled = await Promise.allSettled(
      discovered.map((result) => limit(() => enrichResult(
        result,
        priorByKey.get(`${result.account}:${result.seqnum}`),
      ))),
    );
    const failed = settled.filter((item) => item.status === "rejected");
    for (const failure of failed) {
      logger.warn(`${year}: detail fetch failed:`, (failure as PromiseRejectedResult).reason);
    }
    if (failed.length > 0) {
      logger.error(`${year}: ${failed.length}/${discovered.length} detail pages failed; preserving the previous complete payload.`);
      return;
    }

    const initiatives = sortFlDosInitiatives(
      settled.map((item) => (item as PromiseFulfilledResult<FlDosInitiative>).value),
    );
    const payload: FlDosPayload = { sourceVersion: 1, initiatives };
    if (prior && JSON.stringify(prior) === JSON.stringify(payload)) {
      incrementExistingUnchanged();
      logger.info(`${year}: unchanged (${initiatives.length} initiatives).`);
      return;
    }

    if (prior) incrementExistingChanged();
    else incrementNewEntries();
    const now = new Date();
    await db.insert(CivicApiCache).values({
      addressHash: FL_DOS_ADDRESS_HASH,
      endpoint: FL_DOS_ENDPOINT,
      params: flDosCacheParams(year),
      responseData: payload,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
    }).onConflictDoUpdate({
      target: [CivicApiCache.addressHash, CivicApiCache.endpoint, CivicApiCache.params],
      set: {
        responseData: payload,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
      },
    });
    logger.success(`${year}: cached ${initiatives.length} initiatives.`);
  } catch (error) {
    logger.error(`${year}: scrape failed; preserving any cached payload.`, error);
  } finally {
    incrementTotalProcessed();
  }
}

async function scrape(): Promise<void> {
  if (!enabled()) {
    logger.warn("Live scraping is disabled. Set FL_DOS_SCRAPING_ENABLED=1 after permission/compliance approval.");
    return;
  }

  logger.info("Discovering Florida DOS initiative election years…");
  let rootHtml: string;
  try {
    rootHtml = await fetchHtml(`${FL_DOS_ROOT}/`);
  } catch (error) {
    logger.error("Florida DOS access failed (403 responses are not bypassed).", error);
    throw error;
  }
  const years = parseFlDosYears(rootHtml).filter((year) => year >= MIN_YEAR);
  if (years.length === 0) {
    logger.warn(`No election years >= ${MIN_YEAR} found; nothing to scrape.`);
    return;
  }
  setExpectedTotal(years.length);
  // Years stay sequential so the state host never receives a request burst.
  for (const year of years) await scrapeYear(year);
}

export const flDosInitiatives: Scraper = { name: "fl-dos-initiatives", scrape };
