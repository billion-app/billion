import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBillDualLensGrounding,
  buildDualLensGrounding,
  buildDualLensModelVersion,
  buildDualLensResearchPrompt,
  isUsableDualLens,
  serializeDualLensCacheInput,
} from "./ai/text-generation.js";
import {
  BILL_DESCRIPTION_MAX_CHARS,
  clampBillDescription,
} from "./bill-description.js";

test("clampBillDescription preserves short descriptions", () => {
  assert.equal(
    clampBillDescription(
      "  Funds wildfire research for West Coast vineyards.  ",
    ),
    "Funds wildfire research for West Coast vineyards.",
  );
});

test("clampBillDescription normalizes whitespace and truncates on a word", () => {
  const description = clampBillDescription(
    "This bill directs the Agricultural Research Service to conduct detailed research on smoke exposure and wine grapes across California, Oregon, and Washington.",
  );

  assert.ok(description.length <= BILL_DESCRIPTION_MAX_CHARS);
  assert.match(description, /…$/u);
  assert.doesNotMatch(description, /\s{2,}/u);
  assert.doesNotMatch(description, /\s…$/u);
});

const validLens = {
  left: {
    stance: "Proponents argue",
    points: [
      { text: "The proposal could speed up joint research.", sourceIds: [] },
      { text: "Shared purchasing may lower acquisition costs.", sourceIds: [] },
    ],
  },
  right: {
    stance: "Opponents counter",
    points: [
      {
        text: "Joint systems could complicate export oversight.",
        sourceIds: [],
      },
      {
        text: "Foreign dependencies may create maintenance risks.",
        sourceIds: [],
      },
    ],
  },
};

test("isUsableDualLens rejects placeholder arguments", () => {
  assert.equal(isUsableDualLens(validLens), true);
  assert.equal(
    isUsableDualLens({
      ...validLens,
      left: {
        ...validLens.left,
        points: validLens.left.points.map((point) => ({
          ...point,
          example: {
            fact: "California already lets residents request deletion of personal data.",
            relevance:
              "That existing right shows what the proposal would extend to people in every state.",
          },
        })),
      },
    }),
    true,
  );
  assert.equal(
    isUsableDualLens({
      ...validLens,
      right: {
        ...validLens.right,
        points: [{ text: "N/A", sourceIds: [] }, validLens.right.points[1]],
      },
    }),
    false,
  );
});

test("buildDualLensGrounding puts debate analysis before official text", () => {
  const grounding = buildDualLensGrounding(
    "OFFICIAL BILL TEXT",
    "## Overview\nOverview copy.\n\n## The Debate\nSupporters and critics disagree.",
  );

  assert.match(grounding, /^Generated debate analysis:/);
  assert.ok(
    grounding.indexOf("Supporters and critics") <
      grounding.indexOf("OFFICIAL BILL TEXT"),
  );
});

test("bill lens grounding uses complete section notes and the CRS summary", () => {
  const lateProvision =
    "SEC. 99 imposes a $25,000 penalty after the old lens window.";
  const sectionNotes = `${"early section note ".repeat(400)}${lateProvision}`;
  const grounding = buildBillDualLensGrounding(
    sectionNotes,
    "CRS confirms that the bill establishes civil penalties.",
  );
  const prompt = buildDualLensResearchPrompt("Long Bill", "bill", grounding);

  assert.match(
    prompt,
    /Structured section notes from the complete bill analysis/,
  );
  assert.match(
    prompt,
    /CRS confirms that the bill establishes civil penalties/,
  );
  assert.match(prompt, new RegExp(lateProvision.replace("$", "\\$")));
  assert.doesNotMatch(prompt, /Official source text/);
});

test("bill lens cache input includes the analysis schema version", () => {
  const base = {
    title: "Long Bill",
    grounding: "Complete section notes",
    articleType: "bill",
    modelVersion: "model-v1",
  };

  assert.notEqual(
    serializeDualLensCacheInput({
      ...base,
      analysisSchemaVersion: "bill-section-notes-v1",
    }),
    serializeDualLensCacheInput({
      ...base,
      analysisSchemaVersion: "bill-section-notes-v2",
    }),
  );
  assert.equal(
    buildDualLensModelVersion("model-v1", "bill-section-notes-v1"),
    "model-v1:concrete-examples-v2:bill-section-notes-v1",
  );
});
