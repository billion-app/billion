import type { ScraperEnvContract } from "@acme/env";

export const sccCvigConfig = {
  id: "scc-cvig",
  name: "Santa Clara County voter guides",
  source: "Santa Clara County Registrar voter-guide PDFs",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["GOOGLE_GENERATIVE_AI_API_KEY", "SCC_CVIG_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
