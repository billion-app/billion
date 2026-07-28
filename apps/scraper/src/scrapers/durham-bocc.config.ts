import type { ScraperEnvContract } from "@acme/env";

export const durhamBoccConfig = {
  id: "durham-bocc",
  name: "Durham County BOCC",
  source: "Durham County Legistar Web API — BOCC meetings and actions",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["DURHAM_BOCC_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
