import assert from "node:assert/strict";
import test from "node:test";

import { mentionedTrillionMeasures } from "./trillion-capture.js";

void test("captures both measures in the Analyst's same-ballot conflict reference", () => {
  assert.deepEqual(
    mentionedTrillionMeasures(
      {
        number: "40",
        sources: [
          {
            number: "40",
            role: "official-analysis",
            snapshot:
              "PROPOSITION 39 CONTINUED. If Proposition 41 or 42 on this same ballot receive more yes votes than Proposition 40, then Proposition 40 could be stopped.",
          },
        ],
      },
      ["39", "40", "41", "42"],
    ),
    ["41", "42"],
  );
});

void test("lists stay bounded to the current ballot and the measure's own current sources", () => {
  assert.deepEqual(
    mentionedTrillionMeasures(
      {
        number: "40",
        sources: [
          {
            number: "40",
            role: "legal-text",
            snapshot:
              "Propositions 1, 2, and 3. Props. 3, 4 or 5. Proposition 55. Proposition 40. In 2026, no measure number follows.",
          },
          { number: "40", role: "precedent", snapshot: "Proposition 37" },
          { number: "41", role: "legal-text", snapshot: "Proposition 38" },
        ],
      },
      ["1", "2", "3", "4", "5", "37", "38", "40"],
    ),
    ["1", "2", "3", "4"],
  );
});

void test("does not collect references from precedent or another measure's law", () => {
  assert.deepEqual(
    mentionedTrillionMeasures(
      {
        number: "40",
        sources: [
          { number: "40", role: "precedent", snapshot: "Proposition 37" },
          { number: "41", role: "legal-text", snapshot: "Proposition 38" },
          {
            number: "40",
            role: "official-analysis",
            snapshot: "Proposition 55 and Proposition 40",
          },
        ],
      },
      ["37", "38", "40"],
    ),
    [],
  );
});
