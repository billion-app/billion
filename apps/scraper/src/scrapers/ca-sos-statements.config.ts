import type { ScraperEnvContract } from "@acme/env";

export const caSosStatementsConfig = {
  id: "ca-sos-statements",
  name: "California SOS candidate statements",
  source: "California Secretary of State candidate-statement pages",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["CA_SOS_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
