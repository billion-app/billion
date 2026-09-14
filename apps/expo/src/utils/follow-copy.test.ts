import assert from "node:assert/strict";
import test from "node:test";

import { followAccessibilityLabel, followNoun } from "./follow-copy";

void test("follow nouns stay specific to the record kind", () => {
  assert.equal(followNoun("bill"), "bill");
  assert.equal(followNoun("court_case"), "case");
  assert.equal(followNoun("government_content"), "order");
  assert.equal(followNoun("court"), "case");
  assert.equal(followNoun("exec"), "order");
});

void test("the control speaks save, not follow", () => {
  assert.equal(
    followAccessibilityLabel("bill", false, "Voter ID Act"),
    "Save Voter ID Act for later",
  );
  assert.equal(
    followAccessibilityLabel("bill", true),
    "Remove this bill from saved",
  );
});
