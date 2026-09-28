import type { Scraper } from "../utils/types.js";
import { upsertContent } from "../utils/db/operations.js";
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

export const ecourtRecords: Scraper = {
  ...ecourtRecordsConfig,
  async scrape(options) {
    const limit =
      options?.maxItems ?? Number(process.env.ECOURT_RECORDS_MAX_ITEMS ?? 5);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      throw new Error("eCourt Records maxItems must be 1–20");
    const urls = discoverCriminalCases(await fetchEcourtPage(ECOURT_INDEX));
    const limiter = createNewItemLimiter();
    for (const url of urls.slice(0, limit)) {
      const data = parseCriminalCase(await fetchEcourtPage(url), url);
      const outcome = await upsertContent(
        { type: "court_case", data },
        { newItemLimiter: limiter },
      );
      if (
        outcome.status === "deferred" &&
        outcome.reason === "run budget reached"
      ) {
        logger.warn(
          `Budget deferred ${data.caseNumber}; the next index scan will retry it`,
        );
        continue;
      }
      if (outcome.status === "deferred")
        throw new Error(
          `eCourt Records ${data.caseNumber} deferred: ${outcome.reason}`,
        );
      logger.info(`${outcome.status} ${data.caseNumber}`);
    }
  },
};
