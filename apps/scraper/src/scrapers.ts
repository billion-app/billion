import type { Scraper } from "./utils/types.js";
import { caSosStatements } from "./scrapers/ca-sos-statements.js";
import { congress } from "./scrapers/congress.js";
import { federalregister } from "./scrapers/federalregister.js";
import { legistarScraper } from "./scrapers/legistar.js";
import { openStates } from "./scrapers/open-states.js";
import { sccCvig } from "./scrapers/scc-cvig.js";

export const scrapers: readonly Scraper[] = [
  federalregister,
  legistarScraper,
  congress,
  openStates,
  sccCvig,
  caSosStatements,
];
