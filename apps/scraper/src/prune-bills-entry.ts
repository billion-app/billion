import { loadRepoEnv } from "@acme/env/load";

loadRepoEnv();
await import("./prune-bills.js");
