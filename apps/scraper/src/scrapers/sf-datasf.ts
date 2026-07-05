/**
 * San Francisco DataSF — Ballot Propositions DB scraper.
 *
 * Fetches the complete dataset of historical San Francisco ballot propositions
 * (1907–present) directly from the DataSF Socrata API. Groups the propositions
 * by year and writes one CivicApiCache row per year. The thin API adapter
 * reads these rows at request time and maps them to local ballot measures.
 *
 * Source: https://data.sfgov.org/resource/88s2-6ua9.json
 * Cadence: run on demand or as a low-frequency cron backfill. Re-runs upsert.
 */

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import { createLogger } from "../utils/log.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { getItemLimit } from "../utils/concurrency.js";
import {
  setExpectedTotal,
  incrementTotalProcessed,
  incrementNewEntries,
  incrementExistingUnchanged,
  incrementExistingChanged,
} from "../utils/db/metrics.js";

const logger = createLogger("sf-datasf");

const DATASET_URL = "https://data.sfgov.org/resource/88s2-6ua9.json?$limit=5000";
const CACHE_ENDPOINT = "sf-datasf-propositions";
const CACHE_ADDRESS_HASH = "__global__";
const CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 365 days

export interface SfProposition {
  propletter: string;
  proptitle: string;
  month: string;
  day: string;
  year: string;
  date: string;
  description: string;
  pass_fail: string;
  vote_counts_yes: string;
  vote_counts_no: string;
  percent_vote_yes: string;
  percent_vote_no: string;
  percent_required_to_pass: string;
  kind: string;
  howplaced: string;
  voter_information_pamphlet?: {
    url: string;
  };
}

export interface SfDataSfPayload {
  propositions: SfProposition[];
}

/** Stable stringification for comparison */
function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as Record<string, unknown>).sort());
}

async function scrape(): Promise<void> {
  logger.info("Scraping SF DataSF ballot propositions…");

  let propositions: SfProposition[];
  try {
    const res = await fetchWithRetry(DATASET_URL, {
      headers: { Accept: "application/json" },
    });
    propositions = (await res.json()) as SfProposition[];
  } catch (err) {
    logger.error("Failed to fetch Socrata dataset:", err);
    return;
  }

  if (!Array.isArray(propositions) || propositions.length === 0) {
    logger.warn("Received empty or invalid proposition list from Socrata.");
    return;
  }

  logger.info(`Fetched ${propositions.length} propositions. Grouping by year…`);

  const propositionsByYear = new Map<number, SfProposition[]>();
  for (const prop of propositions) {
    const year = parseInt(prop.year, 10);
    if (isNaN(year)) {
      logger.warn(`Skipping proposition with invalid year: ${JSON.stringify(prop)}`);
      continue;
    }
    if (!propositionsByYear.has(year)) {
      propositionsByYear.set(year, []);
    }
    propositionsByYear.get(year)!.push(prop);
  }

  logger.info(`Found data for ${propositionsByYear.size} distinct years.`);
  setExpectedTotal(propositionsByYear.size);

  const limit = getItemLimit();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

  await Promise.allSettled(
    Array.from(propositionsByYear.entries()).map(([year, props]) =>
      limit(async () => {
        try {
          // Sort propositions for stable hashing/comparison
          props.sort((a, b) => {
            const dateA = a.date ?? "";
            const dateB = b.date ?? "";
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            const letterA = a.propletter ?? "";
            const letterB = b.propletter ?? "";
            if (letterA !== letterB) return letterA.localeCompare(letterB);
            return (a.proptitle ?? "").localeCompare(b.proptitle ?? "");
          });

          const paramsStr = JSON.stringify({ year });
          const payload: SfDataSfPayload = { propositions: props };

          // Retrieve the existing cached record to see if it has changed
          const [existing] = await db
            .select({ responseData: CivicApiCache.responseData })
            .from(CivicApiCache)
            .where(
              and(
                eq(CivicApiCache.addressHash, CACHE_ADDRESS_HASH),
                eq(CivicApiCache.endpoint, CACHE_ENDPOINT),
                eq(CivicApiCache.params, paramsStr),
              ),
            )
            .limit(1);

          if (existing) {
            const existingStr = stableStringify(existing.responseData);
            const newStr = stableStringify(payload);

            if (existingStr === newStr) {
              incrementExistingUnchanged();
              logger.debug(`SF DataSF ${year}: Unchanged, skipping DB write.`);
              return;
            }

            incrementExistingChanged();
            logger.info(`SF DataSF ${year}: Content changed, updating…`);
          } else {
            incrementNewEntries();
            logger.info(`SF DataSF ${year}: New year entry, inserting…`);
          }

          await db
            .insert(CivicApiCache)
            .values({
              addressHash: CACHE_ADDRESS_HASH,
              endpoint: CACHE_ENDPOINT,
              params: paramsStr,
              responseData: payload as unknown as Record<string, unknown>,
              fetchedAt: now,
              expiresAt,
            })
            .onConflictDoUpdate({
              target: [
                CivicApiCache.addressHash,
                CivicApiCache.endpoint,
                CivicApiCache.params,
              ],
              set: {
                responseData: payload as unknown as Record<string, unknown>,
                fetchedAt: now,
                expiresAt,
              },
            });

          logger.success(`SF DataSF ${year}: cached ${props.length} propositions.`);
        } catch (err) {
          logger.error(`SF DataSF ${year}: cache write failed:`, err);
        } finally {
          incrementTotalProcessed();
        }
      }),
    ),
  );

  logger.info("SF DataSF ballot propositions scraping complete.");
}

export const sfDatasf: Scraper = { name: "sf-datasf", scrape };
