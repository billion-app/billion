import type { CourtCaseData, Scraper } from "../utils/types.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import { upsertContent } from "../utils/db/operations.js";
import {
  clearRetry,
  dueRetries,
  recordRetry,
} from "../utils/db/retry-queue.js";
import { createLogger } from "../utils/log.js";
import { createNewItemLimiter } from "../utils/new-item-limit.js";
import { collectScotusCases } from "./scotus-source.js";
import { scotusConfig } from "./scotus.config.js";

const logger = createLogger("SCOTUS");

export async function runScotus(
  maxItems: number,
  dependencies = {
    collect: collectScotusCases,
    write: upsertContent,
    due: dueRetries,
    record: recordRetry,
    clear: clearRetry,
  },
): Promise<void> {
  const key = "scotus";
  const pending = await dependencies.due(key, maxItems);
  const retries = pending.map(({ itemKey }) => {
    const match = /^(\d{4})\/(.+)$/.exec(itemKey);
    if (!match) throw new Error(`Invalid SCOTUS retry key: ${itemKey}`);
    return { year: Number(match[1]), caseNumber: match[2]! };
  });
  const limiter = createNewItemLimiter();
  await dependencies.collect(maxItems, new Date(), {
    retries,
    onCase: async (data, year) => {
      await storeScotusCases([data], async () => {
        const itemKey = `${year}/${data.caseNumber}`;
        const outcome = await dependencies.write(
          { type: "court_case", data },
          { newItemLimiter: limiter },
        );
        if (outcome.status === "deferred") {
          if (outcome.reason !== "run budget reached")
            throw new Error(outcome.reason);
          await dependencies.record(key, itemKey, outcome.reason);
        } else {
          await dependencies.clear(key, itemKey);
          // A newer decision can supersede a queued decision from an older term.
          for (const retry of retries) {
            if (retry.caseNumber === data.caseNumber && retry.year !== year)
              await dependencies.clear(
                key,
                `${retry.year}/${retry.caseNumber}`,
              );
          }
        }
        return outcome;
      });
    },
    onError: async (opinion, year, error) => {
      await dependencies.record(
        key,
        `${year}/${opinion.caseNumber}`,
        error instanceof Error ? error.message : String(error),
      );
    },
  });
}

export async function storeScotusCases(
  cases: CourtCaseData[],
  write = upsertContent,
): Promise<void> {
  setExpectedTotal(cases.length);
  const newItemLimiter = createNewItemLimiter();
  // Newest first, serially: today's ruling gets the first generation slot.
  for (const data of cases) {
    const outcome = await write(
      { type: "court_case", data },
      { newItemLimiter },
    );
    if (outcome.status === "written") {
      logger.success(`Processed ${data.caseNumber}: ${data.title}`);
    } else {
      logger.warn(`${outcome.status} ${data.caseNumber}: ${outcome.reason}`);
      if (
        outcome.status === "deferred" &&
        outcome.reason !== "run budget reached"
      ) {
        throw new Error(
          `SCOTUS ${data.caseNumber} deferred: ${outcome.reason}`,
        );
      }
    }
  }
}

export const scotus: Scraper = {
  ...scotusConfig,
  scrape: async (options) => {
    const maxItems =
      options?.maxItems ?? Number(process.env.SCOTUS_MAX_ITEMS || 20);
    await runScotus(maxItems);
  },
};
