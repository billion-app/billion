import { z } from "zod/v4";

import type { Scraper, ScraperEnvVar } from "./utils/types.js";

const requiredSecret = z.string().trim().min(1, "must be a non-empty string");

const envSchemas = {
  POSTGRES_URL: requiredSecret.refine(
    (value) => /^postgres(?:ql)?:\/\//i.test(value),
    "must be a postgres:// or postgresql:// connection URL",
  ),
  DEEPSEEK_API_KEY: requiredSecret,
  CONGRESS_API_KEY: requiredSecret,
} satisfies Record<ScraperEnvVar, z.ZodType<string>>;

/**
 * Validate only the variables required by the scraper(s) about to run.
 * Values are never included in the error so secrets cannot leak into logs.
 */
export function validateScraperEnv(
  scrapers: readonly Scraper[],
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const requiredBy = new Map<ScraperEnvVar, string[]>();

  for (const scraper of scrapers) {
    for (const variable of scraper.requiredEnv ?? []) {
      const owners = requiredBy.get(variable) ?? [];
      owners.push(scraper.name);
      requiredBy.set(variable, owners);
    }
  }

  const errors: string[] = [];
  for (const [variable, owners] of requiredBy) {
    const value = environment[variable];
    if (!value?.trim()) {
      errors.push(
        `${variable} (${owners.join(", ")}): must be a non-empty string`,
      );
      continue;
    }

    const result = envSchemas[variable].safeParse(value);
    if (result.success) continue;

    const reason = result.error.issues[0]?.message ?? "is invalid";
    errors.push(`${variable} (${owners.join(", ")}): ${reason}`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid scraper environment:\n- ${errors.join("\n- ")}`);
  }
}
