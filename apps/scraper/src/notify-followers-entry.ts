import { loadRepoEnv } from "@acme/env/load";

loadRepoEnv();
await import("./notify-followers.js");
