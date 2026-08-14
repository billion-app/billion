import type { ScraperEnvContract } from "@acme/env";

export const openStatesConfig = {
  id: "open-states",
  name: "Open States",
  source:
    "Open States v3 API — state legislature bills, sponsors, actions, and text",
  environment: {
    required: ["POSTGRES_URL", "OPEN_STATES_API_KEY"],
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
      "OPEN_STATES_MAX_ITEMS",
      "OPEN_STATES_STATES",
      "SCRAPER_SKIP_DUAL_LENS",
    ],
  },
} as const satisfies ScraperEnvContract;
