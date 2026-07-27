import assert from "node:assert/strict";
import test from "node:test";

import {
  generateGovernmentActionBrief,
  isCeremonialGovernmentContent,
  isGovernmentActionDocumentType,
} from "./government-action-brief.js";

test("recognizes commemorative proclamations without classifying substantive orders", () => {
  assert.equal(
    isCeremonialGovernmentContent(
      "Proclamation on Independence Day",
      "Proclamation",
    ),
    true,
  );
  assert.equal(
    isCeremonialGovernmentContent(
      "National Wildfire Preparedness Month",
      "Presidential Proclamation",
    ),
    true,
  );
  assert.equal(
    isCeremonialGovernmentContent(
      "Proclamation Restricting Entry of Certain Foreign Nationals",
      "Proclamation",
    ),
    false,
  );
  assert.equal(
    isCeremonialGovernmentContent(
      "Executive Order Establishing a National Preparedness Day",
      "Executive Order",
    ),
    false,
  );
});

test("limits structured government briefs to presidential actions", () => {
  assert.equal(isGovernmentActionDocumentType("Executive Order"), true);
  assert.equal(isGovernmentActionDocumentType("Memorandum"), true);
  assert.equal(isGovernmentActionDocumentType("Proclamation"), true);
  assert.equal(isGovernmentActionDocumentType("News Article"), false);
});

test("ceremonial briefs are deterministic and do not require an LLM provider", async () => {
  const brief = await generateGovernmentActionBrief({
    title: "Proclamation on Independence Day",
    documentType: "Proclamation",
    description: "Recognizes July 4 as Independence Day.",
    fullText: "I hereby proclaim July 4 as Independence Day.",
  });

  assert.equal(brief?.presentation, "ceremonial");
  assert.equal(brief?.verifiedQuotes, 0);
  assert.match(brief?.hook ?? "", /ceremonial recognition/i);
});
