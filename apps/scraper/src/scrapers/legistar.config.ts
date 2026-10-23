import type { ScraperEnvContract } from "@acme/env";

export const legistarConfig = {
  id: "legistar",
  name: "San José local decisions",
  source:
    "Legistar Web API — public meetings, agenda decisions, documents, histories, and votes",
  environment: {
    required: ["POSTGRES_URL"],
    requiredAny: [],
    recommended: [],
    optional: [
      "LEGISTAR_PAST_DAYS",
      "LEGISTAR_FUTURE_DAYS",
      "LEGISTAR_MAX_ITEMS",
      "LEGISTAR_MAX_DOCUMENT_BYTES",
      "LEGISTAR_SKIP_DOCUMENT_TEXT",
    ],
  },
} as const satisfies ScraperEnvContract;

export const santaClaraLegistarConfig = {
  ...legistarConfig,
  id: "legistar-santaclara",
  name: "Santa Clara local decisions",
} as const satisfies ScraperEnvContract;
