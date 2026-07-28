import { loadRepoEnv } from "@acme/env/load";

loadRepoEnv();

const { main } = await import("./backfill-content-images.js");

await main();
