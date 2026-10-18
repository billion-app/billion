import { loadRepoEnv } from "@acme/env/load";

loadRepoEnv();
await import("./trillion.js");
