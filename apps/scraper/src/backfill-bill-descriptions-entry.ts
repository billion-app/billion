import { loadRepoEnv } from "@acme/env/load";

loadRepoEnv();
await import("./backfill-bill-descriptions.js");
