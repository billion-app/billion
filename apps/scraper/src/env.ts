import type { ScraperName } from "@acme/env";
import { scraperNames, validateEnvironment } from "@acme/env";

import type { Scraper } from "./utils/types.js";

export function validateScraperEnv(
  scrapers: readonly Scraper[],
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const selected = scrapers.map((scraper) => {
    const key = scraper.name.toLowerCase().replace(/[.\s]/g, "");
    if (!scraperNames.includes(key as ScraperName)) {
      throw new Error(
        `Scraper "${scraper.name}" has no environment registry entry`,
      );
    }
    return key as ScraperName;
  });
  const result = validateEnvironment({
    environment,
    surface: "scraper",
    scrapers: selected,
  });
  if (!result.success) {
    throw new Error(
      `Invalid scraper environment:\n- ${result.issues
        .map((issue) => `${issue.key}: ${issue.message}`)
        .join("\n- ")}`,
    );
  }
}
