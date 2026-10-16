import type { ScraperEnvContract } from "@acme/env";

export const caOfficialGuideConfig = {
  id: "ca-official-guide",
  name: "California official election guide",
  source: "California Secretary of State Official Voter Information Guide",
  environment: {
    required: ["POSTGRES_URL", "CA_GUIDE_ELECTION_DATE"],
    // Short list titles only; without a provider the guide caches without them.
    recommended: ["OPENROUTER_API_KEY", "LOCAL_LLM_BASE_URL"],
    optional: [
      "CA_GUIDE_MAX_ITEMS",
      "OPENROUTER_MODEL",
      "LOCAL_LLM_MODEL",
      "LOCAL_LLM_API_KEY",
      "DEEPSEEK_API_KEY",
    ],
  },
} as const satisfies ScraperEnvContract;
