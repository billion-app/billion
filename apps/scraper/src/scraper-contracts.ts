import type { ScraperEnvContract } from "@acme/env";

import { caSosStatementsConfig } from "./scrapers/ca-sos-statements.config.js";
import { cedarParkCouncilConfig } from "./scrapers/civicengage.config.js";
import { congressConfig } from "./scrapers/congress.config.js";
import { durhamBoccConfig } from "./scrapers/durham-bocc.config.js";
import { durhamOnBaseConfig } from "./scrapers/durham-onbase.config.js";
import { federalregisterConfig } from "./scrapers/federalregister.config.js";
import { missouriSosConfig } from "./scrapers/missouri-sos.config.js";
import { ncsbeConfig } from "./scrapers/ncsbe.config.js";
import { sccCvigConfig } from "./scrapers/scc-cvig.config.js";
import { scotusConfig } from "./scrapers/scotus.config.js";
import { texasCurrentElectionConfig } from "./scrapers/texas-current-election.config.js";
import { texasLegislatureConfig } from "./scrapers/texas-legislature.config.js";

export const scraperContracts: readonly ScraperEnvContract[] = [
  federalregisterConfig,
  durhamBoccConfig,
  congressConfig,
  scotusConfig,
  sccCvigConfig,
  caSosStatementsConfig,
  ncsbeConfig,
  missouriSosConfig,
  texasCurrentElectionConfig,
  texasLegislatureConfig,
  cedarParkCouncilConfig,
  durhamOnBaseConfig,
];
