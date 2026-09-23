import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { CourtBriefRecord } from "@acme/validators";

const hash = "a".repeat(64);
const point = (text: string, documentId = "document-1") => ({
  text,
  documentIds: [documentId],
  quote: null,
});

const brief: CourtBriefRecord = {
  takeaway: point("The Court refused to pause the order."),
  action: {
    ...point("The stay was denied.", "document-2"),
    quote: {
      text: "The application is denied.",
      documentId: "document-2",
      locator: "Order, page 1",
    },
  },
  posture: "The Court considered a stay, not the final merits.",
  questions: [point("Should the lower-court order be paused?")],
  reasoning: [
    {
      ...point("The request did not meet the required test."),
      kind: "court_reasoning",
    },
  ],
  effects: [
    {
      ...point("The lower-court order remains in place."),
      group: "The parties",
      certainty: "court_order",
    },
  ],
  opinions: [
    {
      ...point("Justice A concurred with the result.", "document-2"),
      kind: "concurrence",
      author: "Justice A",
    },
  ],
  unknowns: ["The merits remain unresolved."],
  terms: [
    { term: "stay", plain: "A temporary pause." },
    { term: "merits", plain: "The underlying legal questions." },
    { term: "concurred", plain: "Agreed with the result." },
  ],
  version: 1,
  generatorVersion: "court-brief-v1",
  sourceHash: hash,
  sources: [
    {
      id: "document-1",
      url: "https://example.org/order.pdf",
      contentHash: hash,
    },
    {
      id: "document-2",
      url: "https://example.org/opinion.pdf",
      contentHash: hash,
    },
  ],
  court: "Supreme Court of the United States",
  docket: "26A305",
  decisionDate: "2026-09-14",
  proceeding: "emergency_order",
  generatedAt: "2026-09-14T12:00:00.000Z",
  modelVersion: "fixture",
  verifiedQuotes: 1,
};

void test("the web reader renders the structured case instead of bill mechanics", async () => {
  Object.assign(globalThis, { React });
  const { CourtBriefBlocks } = await import("./court-brief");
  const html = renderToStaticMarkup(
    React.createElement(CourtBriefBlocks, {
      brief,
      accent: "#0891B2",
    }),
  );
  assert.match(html, /data-testid="court-brief"/);
  assert.match(html, /What the court did/);
  assert.match(html, /Questions before the court/);
  assert.match(html, /AGREES · CONCURRENCE/);
  assert.match(html, /Define stay/);
  assert.match(html, /https:\/\/example\.org\/opinion\.pdf/);
  assert.doesNotMatch(html, /Committee review|Becomes law|What would change/);
});
