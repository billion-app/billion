import type { ScraperEnvContract } from "@acme/env";

export const scotusConfig = {
  id: "scotus",
  name: "SCOTUS",
  source: "CourtListener API — Supreme Court opinions and dockets",
  environment: {
    required: ["POSTGRES_URL"],
    requiredAny: [
      ["OPENROUTER_API_KEY", "LOCAL_LLM_BASE_URL", "DEEPSEEK_API_KEY"],
    ],
    recommended: [
      "OPENROUTER_API_KEY",
      "LOCAL_LLM_BASE_URL",
      "COURTLISTENER_API_KEY",
    ],
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
      "SCOTUS_MAX_ITEMS",
    ],
  },
} as const satisfies ScraperEnvContract;
