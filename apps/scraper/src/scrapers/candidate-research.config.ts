import type { ScraperEnvContract } from "@acme/env";

export const candidateResearchConfig = {
  id: "candidate-research",
  name: "California candidate research pilot",
  source:
    "CA SOS certified roster, candidate statements and processed FEC filings",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["FEC_API_KEY", "CANDIDATE_RESEARCH_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
