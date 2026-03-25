// Government data scraper for Billion app
// Scrapes bills, presidential actions, and court cases from government websites

// IMPORTANT: Load env FIRST before any other imports
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import { scrapeCongress } from "./scrapers/congress.js";
// Import scrapers AFTER env is loaded (they import db which needs POSTGRES_URL)
import { scrapeGovTrack } from "./scrapers/govtrack.js";
import { scrapeScotus } from "./scrapers/scotus.js";
import { scrapeWhiteHouse } from "./scrapers/whitehouse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: join(__dirname, "../../../.env") });
dotenv.config({ path: join(__dirname, "../.env") });

async function main() {
  console.log("Starting government data scrapers...\n");

  const args = process.argv.slice(2);
  const scraperArg = args[0]?.toLowerCase();

  try {
    if (!scraperArg || scraperArg === "all") {
      // Run all scrapers
      console.log("Running all scrapers...\n");

      await scrapeGovTrack({
        maxBills: 100,
        maxRequests: 500,
        congress: 119,
      });
      console.log("\n---\n");

      await scrapeWhiteHouse();
      console.log("\n---\n");

      await scrapeCongress({
        maxBills: 100,
        maxRequests: 500,
        congress: 119,
        chamber: "House",
      });
      console.log("\n---\n");

      await scrapeScotus({
        court: "scotus",
        maxCases: 50,
      });
      console.log("\n---\n");

      console.log("All scrapers completed successfully!");
    } else if (scraperArg === "govtrack") {
      await scrapeGovTrack({
        maxBills: 100,
        maxRequests: 500,
        congress: 119,
      });
    } else if (scraperArg === "whitehouse") {
      await scrapeWhiteHouse();
    } else if (scraperArg === "congress") {
      await scrapeCongress({
        maxBills: 100,
        maxRequests: 500,
        congress: 119,
        chamber: "House",
      });
    } else if (scraperArg === "scotus") {
      await scrapeScotus({
        court: "scotus",
        maxCases: 50,
      });
    } else {
      console.error(
        "Invalid scraper name. Available options: govtrack, whitehouse, congress, scotus, all",
      );
      process.exit(1);
    }
  } catch (error) {
    console.error("Error running scrapers:", error);
    process.exit(1);
  }
}

main();
