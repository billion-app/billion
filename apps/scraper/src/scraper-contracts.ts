import type { ScraperEnvContract } from "@acme/env";

import { caSosStatementsConfig } from "./scrapers/ca-sos-statements.config.js";
import { congressConfig } from "./scrapers/congress.config.js";
import { federalregisterConfig } from "./scrapers/federalregister.config.js";
import { durhamBoccConfig } from "./scrapers/durham-bocc.config.js";
import { sccCvigConfig } from "./scrapers/scc-cvig.config.js";
import { scotusConfig } from "./scrapers/scotus.config.js";

export const scraperContracts: readonly ScraperEnvContract[] = [
  federalregisterConfig,
  durhamBoccConfig,
  congressConfig,
  scotusConfig,
  sccCvigConfig,
  caSosStatementsConfig,
];
