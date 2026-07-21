import type { ScraperEnvContract } from "@acme/env";

export const congressConfig = {
  id: "congress",
  name: "Congress.gov",
  source: "Congress.gov API — federal bills, summaries, text, and actions",
  environment: {
    required: ["POSTGRES_URL", "CONGRESS_API_KEY"],
    requiredAny: [["OPENROUTER_API_KEY", "DEEPSEEK_API_KEY"]],
    recommended: ["OPENROUTER_API_KEY", "BFL_API_KEY"],
    optional: [
      "OPENROUTER_MODEL",
      "DEEPSEEK_API_KEY",
      "GOOGLE_API_KEY",
      "GOOGLE_SEARCH_ENGINE_ID",
      "CONGRESS_MAX_ITEMS",
    ],
  },
} as const satisfies ScraperEnvContract;
