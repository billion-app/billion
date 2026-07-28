import type { ScraperEnvContract } from "@acme/env";

export const texasLegislatureConfig = {
  id: "texas-legislature",
  name: "Texas Legislature Online",
  source:
    "Texas Legislative Council anonymous FTP — current-session history XML and bulk documents",
  environment: {
    required: ["POSTGRES_URL"],
    optional: [
      "OPEN_STATES_API_KEY",
      "TEXAS_LEGISLATURE_SESSION",
      "TEXAS_LEGISLATURE_MAX_ITEMS",
    ],
  },
} as const satisfies ScraperEnvContract;
