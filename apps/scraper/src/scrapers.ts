import type { Scraper } from "./utils/types.js";
import { caSosStatements } from "./scrapers/ca-sos-statements.js";
import { congress } from "./scrapers/congress.js";
import { federalregister } from "./scrapers/federalregister.js";
import { durhamBocc } from "./scrapers/durham-bocc.js";
import { sccCvig } from "./scrapers/scc-cvig.js";
import { scotus } from "./scrapers/scotus.js";

export const scrapers: readonly Scraper[] = [
  federalregister,
  durhamBocc,
  congress,
  scotus,
  sccCvig,
  caSosStatements,
];
