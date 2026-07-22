import type { Scraper } from "./utils/types.js";
import { caSosStatements } from "./scrapers/ca-sos-statements.js";
import { cedarParkCouncil } from "./scrapers/civicengage.js";
import { congress } from "./scrapers/congress.js";
import { durhamBocc } from "./scrapers/durham-bocc.js";
import { durhamOnBase } from "./scrapers/durham-onbase.js";
import { federalregister } from "./scrapers/federalregister.js";
import { missouriSos } from "./scrapers/missouri-sos.js";
import { ncsbe } from "./scrapers/ncsbe.js";
import { sccCvig } from "./scrapers/scc-cvig.js";
import { scotus } from "./scrapers/scotus.js";
import { texasCurrentElection } from "./scrapers/texas-current-election.js";
import { texasLegislature } from "./scrapers/texas-legislature.js";

export const scrapers: readonly Scraper[] = [
  federalregister,
  durhamBocc,
  congress,
  scotus,
  sccCvig,
  caSosStatements,
  ncsbe,
  missouriSos,
  texasCurrentElection,
  texasLegislature,
  cedarParkCouncil,
  durhamOnBase,
];
