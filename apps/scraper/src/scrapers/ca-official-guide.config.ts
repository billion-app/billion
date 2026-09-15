import type { ScraperEnvContract } from "@acme/env";

export const caOfficialGuideConfig = {
  id: "ca-official-guide",
  name: "California official election guide",
  source: "California Secretary of State Official Voter Information Guide",
  environment: {
    required: ["POSTGRES_URL", "CA_GUIDE_ELECTION_DATE"],
    optional: [],
  },
} as const satisfies ScraperEnvContract;
