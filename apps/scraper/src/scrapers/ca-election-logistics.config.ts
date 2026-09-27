import type { ScraperEnvContract } from "@acme/env";

export const caElectionLogisticsConfig = {
  id: "ca-election-logistics",
  name: "California election voting guidance",
  source: "California Secretary of State election-specific dates and deadlines",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["CA_LOGISTICS_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
