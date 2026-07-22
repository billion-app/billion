import assert from "node:assert/strict";
import test from "node:test";

import { definitionsFor, envRegistry, validateEnvironment } from "./index";

const scraperContracts = [
  {
    id: "congress",
    name: "Congress.gov",
    source: "Congress.gov API",
    environment: {
      required: ["POSTGRES_URL", "CONGRESS_API_KEY"],
      requiredAny: [["OPENROUTER_API_KEY", "DEEPSEEK_API_KEY"]],
      recommended: ["OPENROUTER_API_KEY"],
      optional: ["DEEPSEEK_API_KEY"],
    },
  },
  {
    id: "ca-sos-statements",
    name: "CA SOS statements",
    source: "California SOS",
    environment: { required: ["POSTGRES_URL"] },
  },
] as const;

void test("registry keys are unique", () => {
  const keys = envRegistry.map((definition) => definition.key);
  assert.equal(new Set(keys).size, keys.length);
});

void test("Expo surface never includes secrets", () => {
  assert.deepEqual(
    definitionsFor("expo").map(({ definition }) => definition.key),
    ["EXPO_PUBLIC_API_URL"],
  );
  assert.equal(definitionsFor("expo")[0]?.definition.secret, false);
});

void test("Next.js requires the Google Civic key", () => {
  const civic = definitionsFor("nextjs").find(
    ({ definition }) => definition.key === "GOOGLE_CIVIC_API_KEY",
  );
  assert.equal(civic?.requirement, "required");
});

void test("Next.js requires Discord credentials", () => {
  for (const key of ["AUTH_DISCORD_ID", "AUTH_DISCORD_SECRET"]) {
    const credential = definitionsFor("nextjs").find(
      ({ definition }) => definition.key === key,
    );
    assert.equal(credential?.requirement, "required");
  }
});

void test("Congress validation requires only its relevant core keys", () => {
  const result = validateEnvironment({
    environment: {},
    surface: "scraper",
    scrapers: ["congress"],
    scraperContracts,
  });
  assert.deepEqual(result.issues.map((issue) => issue.key).sort(), [
    "CONGRESS_API_KEY",
    "DEEPSEEK_API_KEY|OPENROUTER_API_KEY",
    "POSTGRES_URL",
  ]);
});

void test("Congress validation accepts either AI provider key", () => {
  for (const aiEnvironment of [
    { OPENROUTER_API_KEY: "openrouter-test-key" },
    { DEEPSEEK_API_KEY: "deprecated-deepseek-test-key" },
  ]) {
    const result = validateEnvironment({
      environment: {
        POSTGRES_URL: "postgres://user:password@example.com:5432/postgres",
        CONGRESS_API_KEY: "congress-test-key",
        ...aiEnvironment,
      },
      surface: "scraper",
      scrapers: ["congress"],
      scraperContracts,
    });
    assert.equal(result.success, true);
  }
});

void test("a cache-only scraper requires just Postgres", () => {
  const result = validateEnvironment({
    environment: {},
    surface: "scraper",
    scrapers: ["ca-sos-statements"],
    scraperContracts,
  });
  assert.deepEqual(
    result.issues.map((issue) => issue.key),
    ["POSTGRES_URL"],
  );
});
