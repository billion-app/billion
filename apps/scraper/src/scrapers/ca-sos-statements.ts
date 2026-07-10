/**
 * California Secretary of State Official Voter Information Guide statement scraper.
 *
 * Fetches the nine statewide-office candidate-statement pages and writes ONE
 * CivicApiCache row per election year. The thin API adapter
 * (packages/api .../ca-sos-voterguide.ts) reads that row at request time and
 * matches a candidate by name — keeping the page fetch + HTML parse out of the
 * serverless API path. The adapter still falls back to a live fetch on a cache
 * miss, so this scraper is a performance/robustness win, not a hard dependency.
 *
 * Source: https://voterguide.sos.ca.gov/candidates/{office}-candidate-statements.htm
 * These URLs are STABLE and election-agnostic (no electionId in the path), so the
 * cron just refetches the same pages — whatever election is live wins. That makes
 * SOS discovery trivial compared to the per-county PDF guides (see scc-cvig.ts).
 * The site WAF-filters bare clients, so we send a browser User-Agent.
 * If those HTML requests are denied, the scraper falls back to the official
 * Voter Information Guide PDF served from the SOS CDN.
 *
 * Cadence: statements publish ~5–6 weeks before each statewide election. Run this
 * on a cron through that window; re-runs upsert the single per-year row.
 */

import type {
  CaSosPayload,
  CaSosStatement,
} from "@acme/api/lib/candidate-sources/ca-sos-cache";
import {
  CA_SOS_ADDRESS_HASH,
  CA_SOS_ENDPOINT,
  caSosCacheParams,
} from "@acme/api/lib/candidate-sources/ca-sos-cache";
import {
  fetchText,
  OFFICE_SLUGS,
  officeUrl,
  parseOfficePage,
} from "@acme/api/lib/candidate-sources/ca-sos-voterguide";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import { createLogger } from "../utils/log.js";
import { caSosStatementsConfig } from "./ca-sos-statements.config.js";
import { fetchVigPdf } from "./ca-sos-vig-pdf.js";

const logger = createLogger("ca-sos-statements");

/** Cache rows live past a single election cycle; re-runs upsert. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** The election year to scrape. SOS pages are election-agnostic, so this only keys the cache row. */
function targetYear(): number {
  return new Date().getFullYear();
}

/** Fetch + parse every statewide office page, deduped by slug to one fetch each. */
async function scrapeAllOffices(
  maxItems = 9,
  electionYear = targetYear(),
): Promise<CaSosStatement[]> {
  const slugs = [...new Set(OFFICE_SLUGS.map((o) => o.slug))];
  const all: CaSosStatement[] = [];
  const unavailable: string[] = [];
  for (const slug of slugs.slice(0, maxItems)) {
    const html = await fetchText(officeUrl(slug));
    if (!html) {
      unavailable.push(slug);
      continue;
    }
    const statements = parseOfficePage(html, slug);
    logger.info(`${slug}: parsed ${statements.length} statements.`);
    all.push(...statements);
  }
  if (all.length === 0) {
    if (unavailable.length > 0) {
      logger.warn(
        `SOS candidate HTML unavailable for ${unavailable.length}/${Math.min(maxItems, slugs.length)} offices; falling back to the official VIG PDF.`,
      );
    } else {
      logger.warn(
        "SOS candidate HTML returned no statements; falling back to the official VIG PDF.",
      );
    }
    const allowedSlugs = new Set(slugs.slice(0, maxItems));
    const pdfStatements = await fetchVigPdf(electionYear, allowedSlugs);
    if (pdfStatements.length > 0) {
      logger.info(
        `Official VIG PDF: parsed ${pdfStatements.length} statements.`,
      );
      all.push(...pdfStatements);
    }
  }
  return all;
}

async function scrape(maxItems = 9): Promise<void> {
  const year = targetYear();
  logger.info(`Scraping CA SOS voter guide for ${year}…`);

  const statements = await scrapeAllOffices(maxItems, year);
  if (statements.length === 0) {
    logger.warn(
      `CA SOS ${year}: no statements extracted — skipping cache write.`,
    );
    return;
  }

  const payload: CaSosPayload = { statements };
  const now = new Date();
  const params = caSosCacheParams(year);
  try {
    await db
      .insert(CivicApiCache)
      .values({
        addressHash: CA_SOS_ADDRESS_HASH,
        endpoint: CA_SOS_ENDPOINT,
        params,
        responseData: payload,
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
          responseData: payload,
          fetchedAt: now,
          expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
        },
      });
    logger.success(`CA SOS ${year}: cached ${statements.length} statements.`);
  } catch (err) {
    logger.error(`CA SOS ${year}: cache write failed:`, err);
  }
}

export const caSosStatements: Scraper = {
  ...caSosStatementsConfig,
  scrape: (options) =>
    scrape((options?.maxItems ?? Number(process.env.CA_SOS_MAX_ITEMS)) || 9),
};
