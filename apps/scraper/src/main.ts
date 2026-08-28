import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  databaseTarget,
  databaseTargetMessage,
  validateScraperEnv,
} from "./env.js";
import { scrapers } from "./scrapers.js";
import { DEFAULT_STATES, parseStates } from "./scrapers/open-states.js";
import { enforceBillRetention } from "./utils/bill-retention.js";
import { setConcurrency } from "./utils/concurrency.js";
import { printMetricsSummary, resetMetrics } from "./utils/db/metrics.js";
import { createLogger } from "./utils/log.js";

const logger = createLogger("main");

const scraperNames = scrapers.map((scraper) => scraper.id);

const argv = await yargs(hideBin(process.argv))
  .command("$0 [scraper]", "Run government data scrapers", (yargs) =>
    yargs.positional("scraper", {
      describe: "Which scraper to run",
      choices: [...scraperNames, "all"] as const,
      default: "all" as const,
    }),
  )
  .option("concurrency", {
    alias: "c",
    type: "number",
    default: 3,
    describe: "Number of items to process concurrently within each scraper",
  })
  .option("max-items", {
    alias: "n",
    type: "number",
    describe:
      "Maximum source records per scraper for this run; overrides the scraper-specific env value",
  })
  .option("bill", {
    alias: "b",
    type: "string",
    array: true,
    describe:
      'Fetch specific bills by number (e.g. --bill "H.R. 7008" for congress, --bill "SB 243" for open-states), ignoring the incremental update cursor. Repeatable. Requires the "congress" or "open-states" scraper',
  })
  .option("congress", {
    type: "number",
    describe: "Congress number for --bill (default: 119)",
  })
  .option("session", {
    type: "string",
    describe:
      'Legislative session for --bill or --bulk-dir on state sources (e.g. --session 20252026). Requires the "open-states" scraper',
  })
  .option("bulk-dir", {
    type: "string",
    describe:
      'Import an unzipped bulk session-CSV export instead of calling the API. Requires the "open-states" scraper. Download the archive while signed in at https://open.pluralpolicy.com/data/session-csv/, unzip it, and pass the directory',
  })
  .option("recent", {
    type: "number",
    describe:
      "Refresh the N most recently updated bills instead of walking the incremental cursor. Keeps active legislation current rather than pursuing complete historical coverage",
  })
  .option("retain", {
    type: "number",
    describe:
      "After a successful recent refresh, retain bills active within --retention-days plus the top N popular, controversial, and talked-about bills",
  })
  .option("retention-days", {
    type: "number",
    default: 90,
    describe: "Rolling activity window protected by --retain",
  })
  .check((args) => {
    const maxItems = args.maxItems;
    if (
      maxItems !== undefined &&
      (typeof maxItems !== "number" ||
        !Number.isInteger(maxItems) ||
        maxItems <= 0)
    ) {
      throw new Error("--max-items must be a positive integer");
    }
    const bills = args.bill;
    if (
      bills?.length &&
      args.scraper !== "congress" &&
      args.scraper !== "open-states"
    ) {
      throw new Error(
        '--bill requires the "congress" or "open-states" scraper',
      );
    }
    if (args.session !== undefined) {
      if (args.scraper !== "open-states") {
        throw new Error('--session requires the "open-states" scraper');
      }
      if (!bills?.length && args.bulkDir === undefined) {
        throw new Error(
          "--session only applies alongside --bill or --bulk-dir",
        );
      }
    }
    if (args.bulkDir !== undefined) {
      if (args.scraper !== "open-states") {
        throw new Error('--bulk-dir requires the "open-states" scraper');
      }
      if (bills?.length) {
        throw new Error("--bulk-dir and --bill select bills different ways");
      }
    }
    const recent = args.recent;
    if (recent !== undefined) {
      if (!Number.isInteger(recent) || recent <= 0) {
        throw new Error("--recent must be a positive integer");
      }
      if (bills?.length) {
        throw new Error("--recent and --bill select bills different ways");
      }
    }
    const retain = args.retain;
    if (retain !== undefined) {
      if (!Number.isInteger(retain) || retain <= 0) {
        throw new Error("--retain must be a positive integer");
      }
      if (recent === undefined) {
        throw new Error("--retain requires --recent");
      }
      if (args.scraper !== "congress" && args.scraper !== "open-states") {
        throw new Error(
          '--retain requires the "congress" or "open-states" scraper',
        );
      }
    }
    const retentionDays = args.retentionDays;
    if (
      typeof retentionDays !== "number" ||
      !Number.isInteger(retentionDays) ||
      retentionDays <= 0
    ) {
      throw new Error("--retention-days must be a positive integer");
    }
    if (args.congress !== undefined && !bills?.length) {
      throw new Error("--congress only applies alongside --bill");
    }
    if (
      args.congress !== undefined &&
      (!Number.isInteger(args.congress) || args.congress <= 0)
    ) {
      throw new Error("--congress must be a positive integer");
    }
    return true;
  })
  .help()
  .parse();

const arg = argv.scraper as string;
const concurrency = (argv as { concurrency: number }).concurrency;
const maxItems = (argv as { maxItems?: number }).maxItems;
const targets = (argv as { bill?: string[] }).bill;
const congressNumber = (argv as { congress?: number }).congress;
const session = (argv as { session?: string }).session;
const bulkDir = (argv as { bulkDir?: string }).bulkDir;
const recent = (argv as { recent?: number }).recent;
const retain = (argv as { retain?: number }).retain;
const retentionDays = (argv as { retentionDays: number }).retentionDays;

function logDatabaseTarget(): void {
  const target = databaseTarget(process.env.POSTGRES_URL!);
  if (target.target === "production") {
    logger.warn(databaseTargetMessage(process.env.POSTGRES_URL!));
  } else {
    logger.info(databaseTargetMessage(process.env.POSTGRES_URL!));
  }
}

async function applyRetentionAfterRefresh(
  scraperId: string,
  topPerCategory: number,
  activeDays: number,
) {
  const jurisdictions =
    scraperId === "congress"
      ? ["US"]
      : (parseStates(process.env.OPEN_STATES_STATES) ?? DEFAULT_STATES).map(
          (state) => state.toUpperCase(),
        );
  const results = await enforceBillRetention(jurisdictions, {
    activeDays,
    topPerCategory,
  });
  for (const result of results) {
    logger.info(
      `Retention ${result.jurisdiction}: protected ${activeDays} active days plus top ${topPerCategory} category leaders; evicted ${result.bills}`,
    );
  }
}

setConcurrency(concurrency);

async function main() {
  resetMetrics();
  if (arg === "all") {
    validateScraperEnv(scrapers);
    logDatabaseTarget();
    logger.info("Running all scrapers...");
    const results = await Promise.allSettled(
      scrapers.map((scraper) => scraper.scrape({ maxItems })),
    );
    const failed = results
      .map((result, i) => ({ result, scraper: scrapers[i] }))
      .filter(({ result }) => result.status === "rejected");
    for (const { result, scraper } of failed) {
      logger.error(
        `Scraper "${scraper!.name}" failed:`,
        (result as PromiseRejectedResult).reason,
      );
    }
    if (failed.length === 0) {
      logger.success("All scrapers completed.");
    } else {
      logger.warn(`${failed.length} scraper(s) failed.`);
    }
    printMetricsSummary("All Scrapers");
  } else {
    const scraper = scrapers.find((scraper) => scraper.id === arg);
    if (!scraper) {
      logger.error(`Unknown scraper: "${arg}"`);
      process.exit(1);
    }
    validateScraperEnv([scraper]);
    logDatabaseTarget();
    await scraper.scrape({
      maxItems,
      targets,
      congress: congressNumber,
      session,
      bulkDir,
      recent,
    });
    if (retain !== undefined) {
      await applyRetentionAfterRefresh(arg, retain, retentionDays);
    }
    printMetricsSummary(scraper.name);
  }
}

main().catch((error) => {
  logger.error("Error running scrapers", error);
  process.exit(1);
});
