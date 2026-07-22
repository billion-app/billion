import type { ScraperEnvContract } from "@acme/env";

export const durhamOnBaseConfig = {
  id: "durham-onbase",
  name: "Durham City Council OnBase",
  source: "City of Durham OnBase Agenda Online",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["DURHAM_ONBASE_MAX_ITEMS", "DURHAM_ONBASE_CACHE_TTL_HOURS"],
  },
} as const satisfies ScraperEnvContract;
