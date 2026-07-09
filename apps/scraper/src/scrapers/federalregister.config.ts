import type { ScraperEnvContract } from "@acme/env";

export const federalregisterConfig = {
  id: "federalregister",
  name: "Federal Register",
  source: "Federal Register API — presidential documents",
  environment: {
    required: ["POSTGRES_URL", "DEEPSEEK_API_KEY"],
    recommended: ["BFL_API_KEY"],
    optional: [
      "GOOGLE_API_KEY",
      "GOOGLE_SEARCH_ENGINE_ID",
      "FEDERALREGISTER_MAX_ITEMS",
    ],
  },
} as const satisfies ScraperEnvContract;
