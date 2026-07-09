import type { ScraperEnvContract } from "@acme/env";

export const scotusConfig = {
  id: "scotus",
  name: "SCOTUS",
  source: "CourtListener API — Supreme Court opinions and dockets",
  environment: {
    required: ["POSTGRES_URL", "DEEPSEEK_API_KEY"],
    recommended: ["COURTLISTENER_API_KEY", "BFL_API_KEY"],
    optional: ["GOOGLE_API_KEY", "GOOGLE_SEARCH_ENGINE_ID", "SCOTUS_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
