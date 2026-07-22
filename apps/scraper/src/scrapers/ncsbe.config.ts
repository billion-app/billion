import type { ScraperEnvContract } from "@acme/env";

export const ncsbeConfig = {
  id: "ncsbe",
  name: "North Carolina State Board of Elections",
  source: "NCSBE candidate, referendum, and election-results files",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["NCSBE_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
