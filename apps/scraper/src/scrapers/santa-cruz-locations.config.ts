import type { ScraperEnvContract } from "@acme/env";

export const santaCruzLocationsConfig = {
  id: "santa-cruz-locations",
  name: "Santa Cruz official vote centers",
  source: "Santa Cruz County election-specific vote center lists",
  environment: {
    required: [
      "POSTGRES_URL",
      "SANTA_CRUZ_ELECTION_DATE",
      "SANTA_CRUZ_ELECTION_PAGE_URL",
    ],
    optional: ["SANTA_CRUZ_LOCATIONS_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
