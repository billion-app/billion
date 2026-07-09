#!/usr/bin/env node
import { runEnvCli } from "@acme/env/cli";

import { scraperContracts } from "./scraper-contracts.js";

await runEnvCli(process.argv.slice(2), scraperContracts);
