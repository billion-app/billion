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
import { govtrack } from "./scrapers/govtrack.js";
import { scotus } from "./scrapers/scotus.js";
import { whitehouse } from "./scrapers/whitehouse.js";
import type { Scraper } from "./utils/types.js";

const scrapers: Scraper[] = [govtrack, whitehouse, congress, scotus];
const scraperNames = scrapers.map((s) => s.name);

const argv = await yargs(hideBin(process.argv))
  .command("$0 [scraper]", "Run government data scrapers", (yargs) =>
    yargs.positional("scraper", {
      describe: "Which scraper to run",
      choices: [...scraperNames.map((n) => n.toLowerCase().replace(/[.\s]/g, "")), "all"] as const,
      default: "all" as const,
    }),
  )
  .help()
  .parse();

const arg = argv.scraper as string;

async function main() {
  if (arg === "all") {
    console.log("Running all scrapers...\n");
    for (const scraper of scrapers) {
      await scraper.scrape();
      console.log("\n---\n");
    }
    console.log("All scrapers completed.");
  } else {
    const scraper = scrapers.find(
      (s) => s.name.toLowerCase().replace(/[.\s]/g, "") === arg,
    );
    if (!scraper) {
      console.error(`Unknown scraper: "${arg}"`);
      process.exit(1);
    }
    await scraper.scrape();
  }
}

main().catch((error) => {
  console.error("Error running scrapers:", error);
  process.exit(1);
});
