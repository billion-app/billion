import type { Scraper } from "./utils/types.js";
import { caElectionLogistics } from "./scrapers/ca-election-logistics.js";
import { caOfficialGuide } from "./scrapers/ca-official-guide.js";
import { caSosStatements } from "./scrapers/ca-sos-statements.js";
import { candidateResearch } from "./scrapers/candidate-research.js";
import { congress } from "./scrapers/congress.js";
import { ecourtRecords } from "./scrapers/ecourt-records.js";
import { federalregister } from "./scrapers/federalregister.js";
import { legistarScraper } from "./scrapers/legistar.js";
import { openStates } from "./scrapers/open-states.js";
import { santaCruzLocations } from "./scrapers/santa-cruz-locations.js";
import { sccCvig } from "./scrapers/scc-cvig.js";
import { scotus } from "./scrapers/scotus.js";
import { whitehouse } from "./scrapers/whitehouse.js";

export const scrapers: readonly Scraper[] = [
  // Ahead of federalregister: it publishes the same documents days earlier, and
  // the Federal Register run skips whatever this one has already stored. In an
  // `all` run the order decides which source owns the row.
  whitehouse,
  federalregister,
  legistarScraper,
  congress,
  scotus,
  ecourtRecords,
  openStates,
  sccCvig,
  caSosStatements,
  candidateResearch,
  caOfficialGuide,
  caElectionLogistics,
  santaCruzLocations,
];
