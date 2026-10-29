import type { ScraperEnvContract } from "@acme/env";

export const caElectionPollingConfig = {
  id: "ca-election-polling",
  name: "California election polling",
  source: "PPIC Statewide Survey likely-voter crosstabs",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["CA_POLLING_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
