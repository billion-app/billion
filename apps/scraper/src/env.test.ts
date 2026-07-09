import assert from "node:assert/strict";
import test from "node:test";

import type { Scraper } from "./utils/types.js";
import { validateScraperEnv } from "./env.js";

const scraper = (name: string): Scraper => ({
  name,
  scrape: async () => undefined,
});

test("allows a scraper with no required environment", () => {
  assert.doesNotThrow(() => validateScraperEnv([scraper("vote411")], {}));
});

test("requires Postgres for a cache-writing scraper", () => {
  assert.throws(
    () => validateScraperEnv([scraper("ca-lao-fiscal")], {}),
    /POSTGRES_URL: is required but missing/,
  );
});

test("validates the Postgres URL scheme", () => {
  assert.throws(
    () =>
      validateScraperEnv([scraper("ca-lao-fiscal")], {
        POSTGRES_URL: "https://example.com/database",
      }),
    /must start with postgres:\/\/ or postgresql:\/\//,
  );
});

test("aggregates requirements for an all run", () => {
  assert.throws(
    () =>
      validateScraperEnv([scraper("federalregister"), scraper("congress")], {}),
    (error: Error) => {
      assert.match(error.message, /POSTGRES_URL: is required but missing/);
      assert.match(error.message, /DEEPSEEK_API_KEY: is required but missing/);
      assert.match(error.message, /CONGRESS_API_KEY: is required but missing/);
      return true;
    },
  );
});

test("accepts a complete Congress environment", () => {
  assert.doesNotThrow(() =>
    validateScraperEnv([scraper("congress")], {
      POSTGRES_URL: "postgres://user:password@example.com:5432/postgres",
      DEEPSEEK_API_KEY: "deepseek-test-key",
      CONGRESS_API_KEY: "congress-test-key",
    }),
  );
});
