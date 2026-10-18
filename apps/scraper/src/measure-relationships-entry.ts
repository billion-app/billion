import { loadRepoEnv } from "@acme/env/load";

loadRepoEnv();
await import("./measure-relationships.js");
