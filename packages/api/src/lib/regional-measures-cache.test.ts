import assert from "node:assert/strict";
import test from "node:test";

import {
  currentRegionalMeasures,
  regionalMeasuresCacheParams,
  regionalSourceUrl,
} from "./regional-measures-cache";

void test("regional cache refuses incomplete and wrong-election records", () => {
  assert.equal(
    currentRegionalMeasures({
      electionDate: "2030-11-03",
      complete: true,
      measures: [],
    }),
    null,
  );
  assert.equal(
    currentRegionalMeasures({
      electionDate: "2026-11-03",
      complete: false,
      measures: [],
    }),
    null,
  );
  assert.equal(
    regionalMeasuresCacheParams("2026-11-03"),
    '{"electionDate":"2026-11-03"}',
  );
});

void test("regional citations accept official HTTPS sources only", () => {
  assert.ok(
    regionalSourceUrl.safeParse("https://smcacre.gov/system/files/source.pdf")
      .success,
  );
  for (const url of [
    "http://smcacre.gov/source.pdf",
    "https://smcacre.gov.evil.example/source.pdf",
    "https://user:pass@smcacre.gov/source.pdf",
    "https://smcacre.gov:3000/source.pdf",
  ])
    assert.equal(regionalSourceUrl.safeParse(url).success, false);
});
