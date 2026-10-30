import assert from "node:assert/strict";
import { test } from "node:test";

import { readerLegalContext } from "./reader-legal-context";

test("terminal source status overrides stale brief tense without implying pending enactment", () => {
  for (const status of ["Vetoed", "Failed", "Withdrawn"]) {
    const context = readerLegalContext("enacted", status);
    assert.equal(context.enacted, false);
    assert.equal(context.closed, true);
    assert.equal(context.scenarioKey, "readerUi.whatProposed");
  }
  assert.equal(
    readerLegalContext("proposed", "Vetoed").statusKey,
    "readerUi.vetoedNotLaw",
  );
  assert.equal(readerLegalContext("proposed", "Enacted").enacted, true);
  assert.equal(
    readerLegalContext("proposed", "Passed House").statusKey,
    "readerUi.proposedNotLaw",
  );
  assert.equal(readerLegalContext("enacted").scenarioKey, "readerUi.underLaw");
  assert.equal(readerLegalContext("proposed").scenarioKey, "readerUi.ifPasses");
});
