import type { ScraperEnvContract } from "@acme/env";

export const caRegionalMeasuresConfig = {
  id: "ca-regional-measures",
  name: "California regional ballot measures",
  source:
    "Public Transit Revenue Measure District and San Mateo County Elections",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["CA_REGIONAL_MEASURES_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
