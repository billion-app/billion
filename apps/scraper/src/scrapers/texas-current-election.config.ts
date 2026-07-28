import type { ScraperEnvContract } from "@acme/env";

export const texasCurrentElectionConfig = {
  id: "texas-current-election",
  name: "Texas SOS/TLC current election cycle",
  source: "Texas Secretary of State and Texas Legislative Council",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["TX_SOS_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
