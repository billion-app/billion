import assert from "node:assert/strict";
import test from "node:test";

import { envSchemas } from "@acme/env";

import { scraperContracts } from "./scraper-contracts.js";

void test("active scraper contracts have unique ids and known env keys", () => {
  const ids = scraperContracts.map((contract) => contract.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const contract of scraperContracts) {
    assert.ok(contract.name);
    assert.ok(contract.source);
    for (const requirement of [
      "required",
      "recommended",
      "optional",
    ] as const) {
      for (const key of contract.environment[requirement] ?? []) {
        assert.ok(envSchemas[key], key);
      }
    }
  }
});

void test("every active scraper exposes a source-record limit", () => {
  for (const contract of scraperContracts) {
    assert.ok(
      contract.environment.optional?.some((key: string) =>
        key.endsWith("_MAX_ITEMS"),
      ),
      contract.id,
    );
  }
});
