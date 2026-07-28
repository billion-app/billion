import type { ScraperEnvContract } from "@acme/env";

export const stLouisAldermenConfig = {
  id: "st-louis-aldermen",
  name: "St. Louis Board of Aldermen",
  source:
    "City of St. Louis active aldermanic session pages and CivicClerk public API",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["ST_LOUIS_ALDERMEN_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
