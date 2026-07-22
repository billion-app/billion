import type { ScraperEnvContract } from "@acme/env";

export const missouriLegislatureConfig = {
  id: "missouri-legislature",
  name: "Missouri General Assembly",
  source:
    "Missouri House official current-session BillList.XML, bill XML, and partial SenateActList.XML",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["OPEN_STATES_API_KEY", "MISSOURI_LEGISLATURE_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
