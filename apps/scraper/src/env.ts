import { envSchemas, validateEnvironment } from "@acme/env";

import type { Scraper } from "./utils/types.js";

export function validateScraperEnv(
  scrapers: readonly Scraper[],
  environment: NodeJS.ProcessEnv = process.env,
): void {
  for (const scraper of scrapers) {
    for (const requirement of [
      "required",
      "recommended",
      "optional",
    ] as const) {
      for (const key of scraper.environment[requirement] ?? []) {
        if (!envSchemas[key]) {
          throw new Error(
            `Scraper "${scraper.id}" declares unknown environment variable ${key}`,
          );
        }
      }
    }
  }
  const result = validateEnvironment({
    environment,
    surface: "scraper",
    scrapers: scrapers.map((scraper) => scraper.id),
    scraperContracts: scrapers,
  });
  if (!result.success) {
    throw new Error(
      `Invalid scraper environment:\n- ${result.issues
        .map((issue) => `${issue.key}: ${issue.message}`)
        .join("\n- ")}`,
    );
  }
}
