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
    ["POSTHOG_PROJECT_TOKEN", "POSTHOG_HOST", "EXPO_PUBLIC_API_URL"],
  );
  assert.equal(
    definitionsFor("expo").every(({ definition }) => !definition.secret),
    true,
  );
});

void test("Expo requires valid PostHog configuration", () => {
  const missing = validateEnvironment({
    environment: { EXPO_PUBLIC_API_URL: "https://example.com" },
    surface: "expo",
  });
  assert.deepEqual(
    missing.issues.map((issue) => issue.key),
    ["POSTHOG_PROJECT_TOKEN", "POSTHOG_HOST"],
  );

  const invalid = validateEnvironment({
    environment: {
      EXPO_PUBLIC_API_URL: "https://example.com",
      POSTHOG_PROJECT_TOKEN: "not-a-project-token",
      POSTHOG_HOST: "not-a-url",
    },
    surface: "expo",
  });
  assert.deepEqual(
    invalid.issues.map((issue) => issue.key),
    ["POSTHOG_PROJECT_TOKEN", "POSTHOG_HOST"],
  );
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
