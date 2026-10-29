import { db } from "@acme/db/client";

import type { Scraper } from "../utils/types.js";
import { createLogger } from "../utils/log.js";
import { parsePpicPdf } from "./ca-election-polling-parser.js";
import {
  discoverPpicReports,
  fetchPpic,
} from "./ca-election-polling-source.js";
import { storeCaliforniaPollingReport } from "./ca-election-polling-store.js";
import { caElectionPollingConfig } from "./ca-election-polling.config.js";

const logger = createLogger("ca-election-polling");
export const caElectionPolling: Scraper = {
  ...caElectionPollingConfig,
  async scrape(options) {
    const limit =
      options?.maxItems ?? Number(process.env.CA_POLLING_MAX_ITEMS ?? 4);
    if (!Number.isInteger(limit) || limit < 1 || limit > 4)
      throw new Error("Polling maxItems must be between 1 and 4 reports");
    const sources = await discoverPpicReports();
    for (const source of sources.slice(0, limit)) {
      const response = await fetchPpic(source.sourceUrl);
      const report = await parsePpicPdf(
        new Uint8Array(await response.arrayBuffer()),
        source,
      );
      await storeCaliforniaPollingReport(db, report);
      logger.info(
        `Stored ${report.publisher} ${report.reportId}, ${report.observations.length} contest observations, fieldwork ${report.fieldStart} to ${report.fieldEnd}`,
      );
    }
  },
};
