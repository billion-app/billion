import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { validateScraperEnv } from "./env.js";
import { scrapers } from "./scrapers.js";
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
    return true;
  })
  .help()
  .parse();

const arg = argv.scraper as string;
const concurrency = (argv as { concurrency: number }).concurrency;
const maxItems = (argv as { maxItems?: number }).maxItems;

setConcurrency(concurrency);

async function main() {
  resetMetrics();
  if (arg === "all") {
    validateScraperEnv(scrapers);
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
    await scraper.scrape({ maxItems });
    printMetricsSummary(scraper.name);
  }
}

main().catch((error) => {
  logger.error("Error running scrapers", error);
  process.exit(1);
});
