import { loadRepoEnv } from "@acme/env/load";

loadRepoEnv();
await import("./bill-interest.js");
