#!/usr/bin/env tsx

/**
 * Scraper runner with proper environment loading
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger, printHeader, printKeyValue, printFooter } from './src/utils/log.js';

const logger = createLogger("env");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
const envPath = join(__dirname, '../../.env');
const result = config({ path: envPath });

if (result.error) {
  logger.error('Error loading .env', result.error);
  process.exit(1);
}

const check = (v: string | undefined) => v ? 'Set' : 'Missing';
printHeader("Environment");
printKeyValue("POSTGRES_URL", check(process.env.POSTGRES_URL));
printKeyValue("PEXELS_API_KEY", check(process.env.PEXELS_API_KEY));
printKeyValue("OPENAI_API_KEY", check(process.env.OPENAI_API_KEY));
printFooter();

// Now import and run main
const { default: main } = await import('./src/main.js');
