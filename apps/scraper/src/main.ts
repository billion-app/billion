import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../../.env") });
dotenv.config({ path: join(__dirname, "../.env") });

import { congress } from "./scrapers/congress.js";
import { govtrack } from "./scrapers/govtrack.js";
import { scotus } from "./scrapers/scotus.js";
import { whitehouse } from "./scrapers/whitehouse.js";
import type { Scraper } from "./utils/types.js";

const scrapers: Scraper[] = [govtrack, whitehouse, congress, scotus];

async function main() {
  const arg = process.argv[2]?.toLowerCase();

  if (arg && arg !== "all") {
    const scraper = scrapers.find((s) => s.name.toLowerCase().replace(/[.\s]/g, "") === arg.replace(/[.\s]/g, ""));
    if (!scraper) {
      console.error(
        `Unknown scraper: "${arg}". Available: ${scrapers.map((s) => s.name).join(", ")}, all`,
      );
      process.exit(1);
    }
    await scraper.scrape();
  } else {
    console.log("Running all scrapers...\n");
    for (const scraper of scrapers) {
      await scraper.scrape();
      console.log("\n---\n");
    }
    console.log("All scrapers completed.");
  }
}

main().catch((error) => {
  console.error("Error running scrapers:", error);
  process.exit(1);
});
