import assert from "node:assert/strict";
import test from "node:test";

import type { Scraper } from "./utils/types.js";
import {
  databaseTarget,
  databaseTargetMessage,
  validateScraperEnv,
} from "./env.js";

test("identifies loopback database hosts as local", () => {
  assert.deepEqual(
    databaseTarget("postgresql://user:password@localhost:5432/postgres"),
    { target: "local", host: "localhost" },
  );
  assert.deepEqual(
    databaseTarget("postgresql://user:password@[::1]:5432/postgres"),
    { target: "local", host: "[::1]" },
  );
});

test("identifies non-loopback database hosts as production", () => {
  assert.deepEqual(
    databaseTarget("postgresql://user:password@db.example.com:5432/postgres"),
    { target: "production", host: "db.example.com" },
  );
  assert.match(
    databaseTargetMessage(
      "postgresql://user:password@db.example.com:5432/postgres",
    ),
    /PRODUCTION database \(db\.example\.com\)/,
  );
});

const scraper = (
  id: string,
  environment: Scraper["environment"] = {},
): Scraper => ({
  id,
  name: id,
  source: "test",
  environment,
  scrape: async () => undefined,
});

test("rejects an unknown variable declared by a scraper", () => {
  assert.throws(
    () =>
      validateScraperEnv(
        [scraper("test", { required: ["MISSPELLED_KEY"] })],
        {},
      ),
    /declares unknown environment variable MISSPELLED_KEY/,
  );
});

test("requires Postgres for a cache-writing scraper", () => {
  assert.throws(
    () =>
      validateScraperEnv(
        [scraper("ca-sos-statements", { required: ["POSTGRES_URL"] })],
        {},
      ),
    /POSTGRES_URL: is required but missing/,
  );
});

test("validates the Postgres URL scheme", () => {
  assert.throws(
    () =>
      validateScraperEnv(
        [scraper("ca-sos-statements", { required: ["POSTGRES_URL"] })],
        {
          POSTGRES_URL: "https://example.com/database",
        },
      ),
    /must start with postgres:\/\/ or postgresql:\/\//,
  );
});

test("aggregates requirements for an all run", () => {
  assert.throws(
    () =>
      validateScraperEnv(
        [
          scraper("federalregister", {
            required: ["POSTGRES_URL"],
            requiredAny: [["OPENROUTER_API_KEY", "DEEPSEEK_API_KEY"]],
            recommended: ["OPENROUTER_API_KEY"],
            optional: ["DEEPSEEK_API_KEY"],
          }),
          scraper("congress", {
            required: ["POSTGRES_URL", "CONGRESS_API_KEY"],
            requiredAny: [["OPENROUTER_API_KEY", "DEEPSEEK_API_KEY"]],
            recommended: ["OPENROUTER_API_KEY"],
            optional: ["DEEPSEEK_API_KEY"],
          }),
        ],
        {},
      ),
    (error: Error) => {
      assert.match(error.message, /POSTGRES_URL: is required but missing/);
      assert.match(
        error.message,
        /one of OPENROUTER_API_KEY, DEEPSEEK_API_KEY is required but all are missing/,
      );
      assert.match(error.message, /CONGRESS_API_KEY: is required but missing/);
      return true;
    },
  );
});

test("accepts a complete Congress environment", () => {
  assert.doesNotThrow(() =>
    validateScraperEnv(
      [
        scraper("congress", {
          required: ["POSTGRES_URL", "CONGRESS_API_KEY"],
          requiredAny: [["OPENROUTER_API_KEY", "DEEPSEEK_API_KEY"]],
          recommended: ["OPENROUTER_API_KEY"],
          optional: ["DEEPSEEK_API_KEY"],
        }),
      ],
      {
        POSTGRES_URL: "postgres://user:password@example.com:5432/postgres",
        OPENROUTER_API_KEY: "openrouter-test-key",
        CONGRESS_API_KEY: "congress-test-key",
      },
    ),
  );
});

test("accepts deprecated DeepSeek during the OpenRouter migration", () => {
  assert.doesNotThrow(() =>
    validateScraperEnv(
      [
        scraper("federalregister", {
          required: ["POSTGRES_URL"],
          requiredAny: [["OPENROUTER_API_KEY", "DEEPSEEK_API_KEY"]],
          recommended: ["OPENROUTER_API_KEY"],
          optional: ["DEEPSEEK_API_KEY"],
        }),
      ],
      {
        POSTGRES_URL: "postgres://user:password@example.com:5432/postgres",
        DEEPSEEK_API_KEY: "deprecated-deepseek-test-key",
      },
    ),
  );
});
