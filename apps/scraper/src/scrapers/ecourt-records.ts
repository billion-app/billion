import { createHash } from "node:crypto";

import { eq, like } from "@acme/db";
import { db } from "@acme/db/client";
import { CourtCase, ScraperRetry } from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import { upsertContent } from "../utils/db/operations.js";
import { clearRetry, recordRetry } from "../utils/db/retry-queue.js";
import { createLogger } from "../utils/log.js";
import { createNewItemLimiter } from "../utils/new-item-limit.js";
import {
  discoverCriminalCases,
  ECOURT_INDEX,
  fetchEcourtPage,
  parseCriminalCase,
} from "./ecourt-records-source.js";
import { ecourtRecordsConfig } from "./ecourt-records.config.js";

const logger = createLogger("eCourt Records");
const SCRAPER_KEY = "ecourt-records";

function retryKey(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

interface CaseRetry {
  updatedAt: Date;
  nextAttemptAt: Date;
}

/** New cases first, then the stored case least recently checked. */
export function selectCriminalCases(
  urls: string[],
  checked: ReadonlyMap<string, Date | null>,
  limit: number,
  retries: ReadonlyMap<string, CaseRetry> = new Map(),
  now = new Date(),
): string[] {
  return [...urls]
    .filter((url) =>
      retries.has(url)
        ? retries.get(url)!.nextAttemptAt.valueOf() <= now.valueOf()
        : true,
    )
    .sort((left, right) => {
      const lastAttempt = (url: string) =>
        Math.max(
          checked.has(url) ? (checked.get(url)?.valueOf() ?? 0) : -1,
          retries.get(url)?.updatedAt.valueOf() ?? -1,
        );
      const leftTime = lastAttempt(left);
      const rightTime = lastAttempt(right);
      return leftTime - rightTime || left.localeCompare(right);
    })
    .slice(0, limit);
}

export const ecourtRecords: Scraper = {
  ...ecourtRecordsConfig,
  async scrape(options) {
    const limit =
      options?.maxItems ?? Number(process.env.ECOURT_RECORDS_MAX_ITEMS ?? 5);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      throw new Error("eCourt Records maxItems must be 1–20");
    const urls = discoverCriminalCases(await fetchEcourtPage(ECOURT_INDEX));
    const prior = await db
      .select({ url: CourtCase.url, updatedAt: CourtCase.updatedAt })
      .from(CourtCase)
      .where(like(CourtCase.url, `${ECOURT_INDEX}us/%`));
    const queued = await db
      .select({
        itemKey: ScraperRetry.itemKey,
        updatedAt: ScraperRetry.updatedAt,
        nextAttemptAt: ScraperRetry.nextAttemptAt,
      })
      .from(ScraperRetry)
      .where(eq(ScraperRetry.scraperKey, SCRAPER_KEY));
    const queuedByKey = new Map(queued.map((row) => [row.itemKey, row]));
    const selected = selectCriminalCases(
      urls,
      new Map(prior.map((row) => [row.url, row.updatedAt])),
      limit,
      new Map(
        urls.flatMap((url) => {
          const retry = queuedByKey.get(retryKey(url));
          return retry ? [[url, retry] as const] : [];
        }),
      ),
    );
    const limiter = createNewItemLimiter();
    const failures: string[] = [];
    for (const url of selected) {
      try {
        const data = parseCriminalCase(await fetchEcourtPage(url), url);
        const outcome = await upsertContent(
          { type: "court_case", data },
          { newItemLimiter: limiter },
        );
        if (outcome.status === "deferred") {
          await recordRetry(SCRAPER_KEY, retryKey(url), outcome.reason);
          if (outcome.reason === "run budget reached") {
            logger.warn(`Budget deferred ${data.caseNumber}; queued for retry`);
            continue;
          }
          failures.push(`${data.caseNumber}: ${outcome.reason}`);
          continue;
        }
        await clearRetry(SCRAPER_KEY, retryKey(url));
        logger.info(`${outcome.status} ${data.caseNumber}`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await recordRetry(SCRAPER_KEY, retryKey(url), reason);
        failures.push(`${url}: ${reason}`);
        logger.error(`Failed to refresh ${url}`, error);
      }
    }
    if (failures.length)
      throw new Error(
        `${failures.length} eCourt Records case(s) failed: ${failures.join("; ")}`,
      );
  },
};
