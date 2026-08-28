import assert from "node:assert/strict";
import test from "node:test";

import {
  BillInterestAssessmentSchema,
  buildBillInterestPrompt,
} from "./bill-interest.js";

void test("bill interest scores stay inside the persisted range", () => {
  assert.equal(
    BillInterestAssessmentSchema.safeParse({
      interestScore: 101,
      controversyScore: 40,
      attentionScore: 20,
      reason: "The proposal would affect a large national program.",
    }).success,
    false,
  );
});

void test("attention instructions require evidence instead of guessed buzz", () => {
  const prompt = buildBillInterestPrompt({
    billNumber: "H.R. 1",
    title: "Example Act",
  });

  assert.match(prompt, /do not infer press or public attention/i);
  assert.match(prompt, /20 or below/i);
  assert.match(prompt, /real product saves/i);
});
