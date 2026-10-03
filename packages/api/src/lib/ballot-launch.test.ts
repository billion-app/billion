import assert from "node:assert/strict";
import { test } from "node:test";

import { getBallotAvailability } from "./ballot-launch";

void test("provider configuration cannot imply reviewed production coverage", () => {
  const previous = process.env.DEMOCRACY_WORKS_API_KEY;
  process.env.DEMOCRACY_WORKS_API_KEY = "synthetic-configured-key";
  try {
    assert.deepEqual(getBallotAvailability(), {
      status: "verification_required",
      lookupEnabled: false,
      supportedAreas: [],
      officialBallotEvidence: [],
      productionMobileEvidence: [],
    });
  } finally {
    if (previous === undefined) delete process.env.DEMOCRACY_WORKS_API_KEY;
    else process.env.DEMOCRACY_WORKS_API_KEY = previous;
  }
});
