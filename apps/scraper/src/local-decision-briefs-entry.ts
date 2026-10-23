import { loadRepoEnv } from "@acme/env/load";

loadRepoEnv();
await import("./local-decision-briefs.js");
