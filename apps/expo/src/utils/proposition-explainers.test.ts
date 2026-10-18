import assert from "node:assert/strict";
import test from "node:test";

import {
  officialVoteMeaning,
  propositionDetailRoute,
  splitOfficialTitle,
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

test("official titles split into subject and legal kind", () => {
  assert.deepEqual(
    splitOfficialTitle(
      "AUTHORIZES BONDS FOR HOUSING AFFORDABILITY PROGRAMS. LEGISLATIVE STATUTE.",
    ),
    {
      subject: "AUTHORIZES BONDS FOR HOUSING AFFORDABILITY PROGRAMS.",
      kind: "Legislative statute",
    },
  );
  assert.deepEqual(
    splitOfficialTitle(
      "IMPOSES ONE-TIME TAX ON CERTAIN TAXPAYERS. INITIATIVE CONSTITUTIONAL AMENDMENT AND STATUTE.",
    ).kind,
    "Initiative constitutional amendment and statute",
  );
  assert.deepEqual(splitOfficialTitle("Measure without a kind"), {
    subject: "Measure without a kind",
  });
});
