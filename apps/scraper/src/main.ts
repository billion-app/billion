import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../../.env") });
dotenv.config({ path: join(__dirname, "../.env") });

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { congress } from "./scrapers/congress.js";
import { scotus } from "./scrapers/scotus.js";
import { federalregister } from "./scrapers/federalregister.js";
import type { Scraper } from "./utils/types.js";
import { createLogger } from "./utils/log.js";
import { setConcurrency } from "./utils/concurrency.js";
import { resetMetrics, printMetricsSummary } from "./utils/db/metrics.js";

const logger = createLogger("main");

const scrapers: Scraper[] = [federalregister, congress, scotus];
const scraperNames = scrapers.map((s) => s.name);

const argv = await yargs(hideBin(process.argv))
  .command("$0 [scraper]", "Run government data scrapers", (yargs) =>
    yargs.positional("scraper", {
      describe: "Which scraper to run",
      choices: [...scraperNames.map((n) => n.toLowerCase().replace(/[.\s]/g, "")), "all"] as const,
      default: "all" as const,
    }),
  )
  .option("concurrency", {
    alias: "c",
    type: "number",
    default: 3,
    describe: "Number of items to process concurrently within each scraper",
  })
  .help()
  .parse();

const arg = argv.scraper as string;
const concurrency = (argv as { concurrency: number }).concurrency;

setConcurrency(concurrency);

async function main() {
  resetMetrics();
  if (arg === "all") {
    logger.info("Running all scrapers...");
    const results = await Promise.allSettled(scrapers.map((s) => s.scrape()));
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
    const scraper = scrapers.find(
      (s) => s.name.toLowerCase().replace(/[.\s]/g, "") === arg,
    );
    if (!scraper) {
      logger.error(`Unknown scraper: "${arg}"`);
      process.exit(1);
    }
    await scraper.scrape();
    printMetricsSummary(scraper.name);
  }
}

main().catch((error) => {
  logger.error("Error running scrapers", error);
  process.exit(1);
});
