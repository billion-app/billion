import assert from "node:assert/strict";
import test from "node:test";

import { definitionsFor, envRegistry, validateEnvironment } from "./index";

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

void test("Congress validation requires only its relevant core keys", () => {
  const result = validateEnvironment({
    environment: {},
    surface: "scraper",
    scrapers: ["congress"],
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
  });
  assert.deepEqual(
    result.issues.map((issue) => issue.key),
    ["POSTGRES_URL"],
  );
});
