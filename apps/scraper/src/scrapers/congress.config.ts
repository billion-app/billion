import type { ScraperEnvContract } from "@acme/env";

export const congressConfig = {
  id: "congress",
  name: "Congress.gov",
  source: "Congress.gov API — federal bills, summaries, text, and actions",
  environment: {
    required: ["POSTGRES_URL", "CONGRESS_API_KEY"],
    requiredAny: [
      ["OPENROUTER_API_KEY", "LOCAL_LLM_BASE_URL", "DEEPSEEK_API_KEY"],
    ],
    recommended: ["OPENROUTER_API_KEY", "LOCAL_LLM_BASE_URL"],
    optional: [
      "OPENROUTER_MODEL",
      "LOCAL_LLM_MODEL",
      "LOCAL_LLM_API_KEY",
      "DEEPSEEK_API_KEY",
      "BFL_API_KEY",
      "BFL_MODEL",
      "LOCAL_FLUX_BASE_URL",
      "LOCAL_FLUX_MODEL",
      "GOOGLE_API_KEY",
      "GOOGLE_SEARCH_ENGINE_ID",
      "CONGRESS_MAX_ITEMS",
    ],
  },
} as const satisfies ScraperEnvContract;
