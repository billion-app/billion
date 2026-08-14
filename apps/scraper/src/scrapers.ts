import type { Scraper } from "./utils/types.js";
import { caSosStatements } from "./scrapers/ca-sos-statements.js";
import { congress } from "./scrapers/congress.js";
import { federalregister } from "./scrapers/federalregister.js";
import { openStates } from "./scrapers/open-states.js";
import { sccCvig } from "./scrapers/scc-cvig.js";
import { whitehouse } from "./scrapers/whitehouse.js";

export const scrapers: readonly Scraper[] = [
  // Ahead of federalregister: it publishes the same documents days earlier, and
  // the Federal Register run skips whatever this one has already stored. In an
  // `all` run the order decides which source owns the row.
  whitehouse,
  federalregister,
  congress,
  openStates,
  sccCvig,
  caSosStatements,
];
