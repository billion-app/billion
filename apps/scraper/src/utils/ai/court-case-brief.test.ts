import assert from "node:assert/strict";
import test from "node:test";

import type { CourtCaseBrief } from "@acme/validators";

import { verifyCourtCaseBriefQuotes } from "./court-case-brief.js";

const brief: CourtCaseBrief = {
  badge: "ARGUED",
  hook: "The court is deciding whether police need **a warrant for location records** before reading a person's past movements.",
  facts: [],
  terms: [],
  unknowns: [],
  sections: [
    {
      title: "The question before the court",
      items: [
        {
          text: "The case asks whether **the warrant requirement applies**.",
          quote: {
            text: "The question presented is whether the Fourth Amendment's warrant requirement extends to historical records.",
          },
        },
        {
          text: "This item has **an invented supporting quote**.",
          quote: {
            text: "This sentence does not appear in the official source at all.",
          },
        },
      ],
    },
    {
      title: "What could change",
      items: [{ text: "The ruling could **change police access rules**." }],
    },
  ],
};

test("court-case brief verification keeps grounded quotes and drops invented ones", () => {
  const result = verifyCourtCaseBriefQuotes(
    brief,
    "The question presented is whether the Fourth Amendment’s warrant requirement extends to historical records.",
  );

  assert.equal(result.verified, 1);
  assert.equal(result.dropped, 1);
  assert.ok(result.brief.sections[0]?.items[0]?.quote);
  assert.equal(result.brief.sections[0]?.items[1]?.quote, undefined);
});
