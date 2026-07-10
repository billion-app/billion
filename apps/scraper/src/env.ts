import { envSchemas, validateEnvironment } from "@acme/env";

import type { Scraper } from "./utils/types.js";

const LOCAL_DATABASE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

export type DatabaseTarget = "local" | "production";

export function databaseTarget(databaseUrl: string): {
  target: DatabaseTarget;
  host: string;
} {
  const host = new URL(databaseUrl).hostname;
  return {
    target: LOCAL_DATABASE_HOSTS.has(host) ? "local" : "production",
    host,
  };
}

export function databaseTargetMessage(databaseUrl: string): string {
  const { target, host } = databaseTarget(databaseUrl);
  return target === "local"
    ? `This job writes to a local host database (${host}).`
    : `This job writes to the PRODUCTION database (${host}).`;
}

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
