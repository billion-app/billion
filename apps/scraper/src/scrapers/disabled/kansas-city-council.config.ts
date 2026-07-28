import type { ScraperEnvContract } from "@acme/env";

export const kansasCityCouncilConfig = {
  id: "kansas-city-council",
  name: "Kansas City Council",
  source: "Kansas City Legistar Web API — Council meetings and roll-call votes",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["KANSAS_CITY_COUNCIL_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
