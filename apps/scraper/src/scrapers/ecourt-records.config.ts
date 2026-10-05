import type { ScraperEnvContract } from "@acme/env";

export const ecourtRecordsConfig = {
  id: "ecourt-records",
  name: "eCourt Records criminal dockets",
  source:
    "eCourt Records public case archive (independent, non-official snapshots)",
  environment: {
    required: ["POSTGRES_URL"],
    requiredAny: [
      [
        "OPENROUTER_API_KEY",
        "LOCAL_LLM_BASE_URL",
        "DEEPSEEK_API_KEY",
        "SCRAPER_FALLBACK_BASE_URL",
      ],
    ],
    recommended: ["OPENROUTER_API_KEY", "LOCAL_LLM_BASE_URL"],
    optional: ["ECOURT_RECORDS_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
