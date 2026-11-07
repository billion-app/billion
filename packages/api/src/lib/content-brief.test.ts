import assert from "node:assert/strict";
import test from "node:test";

import { parseCurrentContentBrief } from "./content-brief";

const brief = {
  version: 8,
  summary:
    "The proposal would **change one concrete rule** for affected readers.",
  hook: "If passed, the proposal would **change one concrete rule** for affected readers while leaving implementation details to the agency.",
  facts: [],
  changes: [
    {
      kind: "requires",
      title: "A concrete policy requirement",
      before: "The requirement does not apply today.",
      after: "The requirement would apply after enactment.",
    },
  ],
  affected: [
    {
      group: "Covered organizations",
      takeaway: "Organizations would take on **a new reporting requirement**.",
      effect: "They would have to submit a report every year.",
      direction: "loses",
    },
  ],
  unknowns: ["The proposal leaves **implementation timing** to the agency."],
  terms: [],
  reading: [],
  legalStatus: "proposed",
  verifiedQuotes: 0,
  generatedAt: "2026-09-13T00:00:00.000Z",
  modelVersion: "test",
};

void test("returns a valid brief when its source content hash matches", () => {
  assert.ok(
    parseCurrentContentBrief(
      { brief, contentHash: "current-content" },
      "current-content",
    ),
  );
});

void test("rejects a stale brief when its source content hash changed", () => {
  assert.equal(
    parseCurrentContentBrief(
      { brief, contentHash: "old-content" },
      "current-content",
    ),
    null,
  );
});
