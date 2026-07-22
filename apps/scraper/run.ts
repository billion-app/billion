#!/usr/bin/env tsx

/**
 * Scraper runner with proper environment loading
 */
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { loadRepoEnv } from "@acme/env/load";

import {
  createLogger,
  printFooter,
  printHeader,
  printKeyValue,
} from "./src/utils/log.js";

const logger = createLogger("env");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
const result = loadRepoEnv(join(__dirname, "../.."));

if (result.error) {
  logger.error("Error loading .env", result.error);
  process.exit(1);
}

const check = (v: string | undefined) => (v ? "Set" : "Missing");
printHeader("Environment");
printKeyValue("POSTGRES_URL", check(process.env.POSTGRES_URL));
printKeyValue("OPENROUTER_API_KEY", check(process.env.OPENROUTER_API_KEY));
printKeyValue(
  "DEEPSEEK_API_KEY (deprecated)",
  check(process.env.DEEPSEEK_API_KEY),
);
printKeyValue("BFL_API_KEY", check(process.env.BFL_API_KEY));
printKeyValue("CONGRESS_API_KEY", check(process.env.CONGRESS_API_KEY));
printFooter();

// Now import and run main
const { default: main } = await import("./src/main.js");
