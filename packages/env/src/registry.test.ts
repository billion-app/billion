import assert from "node:assert/strict";
import test from "node:test";

import { definitionsFor, envRegistry, validateEnvironment } from "./index";

const scraperContracts = [
  {
    id: "congress",
    name: "Congress.gov",
    source: "Congress.gov API",
    environment: {
      required: ["POSTGRES_URL", "DEEPSEEK_API_KEY", "CONGRESS_API_KEY"],
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

void test("Congress validation requires only its relevant core keys", () => {
  const result = validateEnvironment({
    environment: {},
    surface: "scraper",
    scrapers: ["congress"],
    scraperContracts,
  });
  assert.deepEqual(result.issues.map((issue) => issue.key).sort(), [
    "CONGRESS_API_KEY",
    "DEEPSEEK_API_KEY",
    "POSTGRES_URL",
  ]);
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
