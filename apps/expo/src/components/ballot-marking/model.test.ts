import assert from "node:assert/strict";
import test from "node:test";

import type { ContestInstructions } from "./model";
import {
  applicableInstructions,
  instructionDiagram,
  selectionLabel,
} from "./model";

// Synthetic mechanics exercise the contract, never published jurisdiction rules.
const scope = {
  contestId: "fixture-council",
  electionDate: "2026-11-03",
  jurisdiction: "fixture",
};
const base: ContestInstructions = {
  scope,
  source: {
    authority: "Fixture election office",
    url: "https://example.org/instructions",
    reviewedAt: "2026-10-02",
  },
  system: "Fixture plurality",
  mechanics: { kind: "single", maximum: 1 },
  marking: "Fixture: fill the target beside one candidate.",
  example: "Fixture: Candidate A has one filled target; Candidate B has none.",
};
for (const [mechanics, label] of [
  [{ kind: "single", maximum: 1 }, "Choose no more than 1"],
  [{ kind: "multiple", maximum: 3 }, "Choose up to 3 candidates"],
  [{ kind: "ranked", maximum: 5 }, "Rank up to 5 candidates"],
] as const)
  test(label, () => {
    const input = { ...base, mechanics };
    assert.equal(applicableInstructions(input, scope), input);
    assert.equal(selectionLabel(input), label);
  });
test("missing instructions remain unknown", () =>
  assert.equal(applicableInstructions(undefined, scope), undefined));
test("another contest, election, or jurisdiction cannot inherit rules", () => {
  for (const key of Object.keys(scope))
    assert.equal(
      applicableInstructions(base, { ...scope, [key]: "different" }),
      undefined,
    );
});
test("reject invalid limits and missing evidence", () => {
  for (const maximum of [0, -1, 1.5, Infinity, 2])
    assert.equal(
      applicableInstructions(
        {
          ...base,
          mechanics: { kind: "single", maximum },
        },
        scope,
      ),
      undefined,
    );
  assert.equal(
    applicableInstructions(
      { ...base, source: { ...base.source, url: "javascript:alert(1)" } },
      scope,
    ),
    undefined,
  );
  assert.equal(
    applicableInstructions(
      { ...base, source: { ...base.source, reviewedAt: "unknown" } },
      scope,
    ),
    undefined,
  );
});

test("diagram requires reviewed text and valid target positions", () => {
  const exampleDiagram = {
    target: "oval" as const,
    columns: ["Mark"],
    rows: [{ label: "Candidate A", filledColumns: [0] }],
  };
  assert.equal(instructionDiagram({ ...base, exampleDiagram }), exampleDiagram);
  assert.equal(instructionDiagram(base), undefined);
  assert.equal(
    instructionDiagram({
      ...base,
      exampleDiagram: {
        ...exampleDiagram,
        rows: [{ label: "Candidate A", filledColumns: [1] }],
      },
    }),
    undefined,
  );
});
