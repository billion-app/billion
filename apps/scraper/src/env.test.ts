import assert from "node:assert/strict";
import test from "node:test";

import type { Scraper } from "./utils/types.js";
import { validateScraperEnv } from "./env.js";

const scraper = (
  name: string,
  requiredEnv: Scraper["requiredEnv"],
): Scraper => ({
  name,
  requiredEnv,
  scrape: async () => undefined,
});

test("allows a scraper with no required environment", () => {
  assert.doesNotThrow(() => validateScraperEnv([scraper("vote411", [])], {}));
});

test("requires Postgres for a cache-writing scraper", () => {
  assert.throws(
    () => validateScraperEnv([scraper("ca-lao-fiscal", ["POSTGRES_URL"])], {}),
    /POSTGRES_URL \(ca-lao-fiscal\): must be a non-empty string/,
  );
});

test("validates the Postgres URL scheme", () => {
  assert.throws(
    () =>
      validateScraperEnv([scraper("ca-lao-fiscal", ["POSTGRES_URL"])], {
        POSTGRES_URL: "https://example.com/database",
      }),
    /must be a postgres:\/\/ or postgresql:\/\/ connection URL/,
  );
});

test("aggregates requirements for an all run", () => {
  assert.throws(
    () =>
      validateScraperEnv(
        [
          scraper("federalregister", ["POSTGRES_URL", "DEEPSEEK_API_KEY"]),
          scraper("congress", [
            "POSTGRES_URL",
            "DEEPSEEK_API_KEY",
            "CONGRESS_API_KEY",
          ]),
        ],
        {},
      ),
    (error: Error) => {
      assert.match(error.message, /POSTGRES_URL \(federalregister, congress\)/);
      assert.match(
        error.message,
        /DEEPSEEK_API_KEY \(federalregister, congress\)/,
      );
      assert.match(error.message, /CONGRESS_API_KEY \(congress\)/);
      return true;
    },
  );
});

test("accepts a complete Congress environment", () => {
  assert.doesNotThrow(() =>
    validateScraperEnv(
      [
        scraper("congress", [
          "POSTGRES_URL",
          "DEEPSEEK_API_KEY",
          "CONGRESS_API_KEY",
        ]),
      ],
      {
        POSTGRES_URL: "postgres://user:password@example.com:5432/postgres",
        DEEPSEEK_API_KEY: "deepseek-test-key",
        CONGRESS_API_KEY: "congress-test-key",
      },
    ),
  );
});
