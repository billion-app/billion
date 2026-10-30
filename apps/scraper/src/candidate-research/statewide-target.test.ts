import assert from "node:assert/strict";
import test from "node:test";

import {
  candidateResearchTarget,
  validateResearchTargetArgs,
} from "./statewide-target.js";

void test("research defaults to CA17 and accepts a bounded explicit statewide race", () => {
  assert.equal(candidateResearchTarget(), "ca-house-17-2026");
  const args = {
    scraper: "candidate-research",
    target: ["ca-lieutenant-governor-2026"],
    maxItems: 1,
  };
  assert.doesNotThrow(() => validateResearchTargetArgs(args));
  assert.equal(
    candidateResearchTarget(args.target),
    "ca-lieutenant-governor-2026",
  );
});

void test("research targets reject unrelated scrapers, mixed selectors, unknown races and partial or unbounded runs", () => {
  const valid = {
    scraper: "candidate-research",
    target: ["ca-lieutenant-governor-2026"],
    maxItems: 1,
  };
  for (const args of [
    { ...valid, scraper: "all" },
    { ...valid, scraper: "congress" },
    { ...valid, bill: ["H.R. 1"] },
    { ...valid, target: ["unknown"] },
    { ...valid, target: [] },
    { ...valid, target: ["ca-house-17-2026", "ca-lieutenant-governor-2026"] },
    { ...valid, maxItems: undefined },
    { ...valid, maxItems: 0 },
    { ...valid, maxItems: 2 },
  ])
    assert.throws(() => validateResearchTargetArgs(args));
  assert.doesNotThrow(() =>
    validateResearchTargetArgs({ scraper: "congress", bill: ["H.R. 1"] }),
  );
});
