import type { ScraperEnvContract } from "@acme/env";

export const federalregisterConfig = {
  id: "federalregister",
  name: "Federal Register",
  source: "Federal Register API — presidential documents",
  environment: {
    required: ["POSTGRES_URL"],
    requiredAny: [["OPENROUTER_API_KEY", "DEEPSEEK_API_KEY"]],
    recommended: ["OPENROUTER_API_KEY", "BFL_API_KEY"],
    optional: [
      "OPENROUTER_MODEL",
      "DEEPSEEK_API_KEY",
      "GOOGLE_API_KEY",
      "GOOGLE_SEARCH_ENGINE_ID",
      "FEDERALREGISTER_MAX_ITEMS",
    ],
  },
} as const satisfies ScraperEnvContract;
