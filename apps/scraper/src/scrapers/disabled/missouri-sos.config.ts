import type { ScraperEnvContract } from "@acme/env";

export const missouriSosConfig = {
  id: "missouri-sos",
  name: "Missouri SOS current election cycle",
  source: "Missouri Secretary of State",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["MISSOURI_SOS_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
