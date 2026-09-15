import type { CourtCaseData, Scraper } from "../utils/types.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import { upsertContent } from "../utils/db/operations.js";
import { createLogger } from "../utils/log.js";
import { createNewItemLimiter } from "../utils/new-item-limit.js";
import { collectScotusCases } from "./scotus-source.js";
import { scotusConfig } from "./scotus.config.js";

const logger = createLogger("SCOTUS");

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
    const cases = await collectScotusCases(maxItems);
    await storeScotusCases(cases);
  },
};
