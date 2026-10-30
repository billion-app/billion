import type { ScraperEnvContract } from "@acme/env";

export const candidateResearchConfig = {
  id: "candidate-research",
  name: "Bounded California candidate research",
  source:
    "CA SOS certified rosters and candidate statements; office authorities; jurisdiction-specific campaign finance",
  environment: {
    required: ["POSTGRES_URL"],
    optional: [
      "FEC_API_KEY",
      "CANDIDATE_RESEARCH_MAX_ITEMS",
      "CANDIDATE_RESEARCH_REVIEW_MODEL",
    ],
  },
} as const satisfies ScraperEnvContract;
