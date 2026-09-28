import assert from "node:assert/strict";
import test from "node:test";

import {
  officialVoteMeaning,
  propositionDetailRoute,
  submittedGuideArguments,
} from "./proposition-explainers";

test("navigation carries only the proposition number", () => {
  assert.deepEqual(propositionDetailRoute("5"), {
    pathname: "/proposition-detail",
    params: { number: "5" },
  });
});

test("official vote wording drops only the label already displayed", () => {
  assert.equal(
    officialVoteMeaning(
      "A YES vote on this measure means: The law changes.",
      "YES",
    ),
    "The law changes.",
  );
  assert.equal(
    officialVoteMeaning("The law stays the same.", "NO"),
    "The law stays the same.",
  );
  assert.equal(
    officialVoteMeaning(
      "A NO vote on this measure means: The law stays.",
      "YES",
    ),
    "A NO vote on this measure means: The law stays.",
  );
});

test("a guide notice about absent arguments does not become advocacy text", () => {
  assert.deepEqual(
    submittedGuideArguments([
      { text: "NO ARGUMENT AGAINST PROPOSITION 1 WAS SUBMITTED." },
      { text: "A submitted argument" },
    ]),
    [{ text: "A submitted argument" }],
  );
});
