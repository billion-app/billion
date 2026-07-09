import type { ScraperEnvContract } from "@acme/env";

export const congressConfig = {
  id: "congress",
  name: "Congress.gov",
  source: "Congress.gov API — federal bills, summaries, text, and actions",
  environment: {
    required: ["POSTGRES_URL", "DEEPSEEK_API_KEY", "CONGRESS_API_KEY"],
    recommended: ["BFL_API_KEY"],
    optional: [
      "GOOGLE_API_KEY",
      "GOOGLE_SEARCH_ENGINE_ID",
      "CONGRESS_MAX_ITEMS",
    ],
  },
} as const satisfies ScraperEnvContract;
