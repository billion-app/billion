import assert from "node:assert/strict";
import test from "node:test";

import type { BillAnalysis } from "@acme/validators";

import {
  assertCompleteSectionCoverage,
  BILL_SECTION_CHUNK_LIMIT,
  formatBillAnalysis,
  splitBillIntoSections,
} from "./bill-analysis.js";

void test("section inventory retains the preamble and every legislative section", () => {
  const source = [
    "119th CONGRESS 1st Session H. R. 7008 A BILL",
    "SECTION 1. SHORT TITLE. This Act may be cited as the Example Act.",
    "SEC. 2. REQUIREMENT. A covered person shall file a report.",
    "SEC. 3. PENALTIES. A covered person who violates section 2 shall pay the greater of $2,000 or 10 percent of the transaction value.",
  ].join(" ");

  const sections = splitBillIntoSections(source);

  assert.deepEqual(
    sections.map((section) => section.locator),
    [
      "Preamble",
      "SECTION 1. SHORT TITLE.",
      "SEC. 2. REQUIREMENT.",
      "SEC. 3. PENALTIES.",
    ],
  );
  assert.equal(sections.map((section) => section.text).join(""), source);
  assertCompleteSectionCoverage(sections, source.length);
  assert.match(sections.at(-1)!.text, /greater of \$2,000 or 10 percent/);
});

void test("oversized sections use bounded overlapping parts without coverage gaps", () => {
  const repeatedProvision =
    " The Administrator shall publish a quarterly report for every covered project.";
  const source = `SEC. 1. REPORTING.${repeatedProvision.repeat(500)}`;
  const sections = splitBillIntoSections(source);

  assert.ok(sections.length > 1);
  assert.ok(
    sections.every(
      (section) => section.text.length <= BILL_SECTION_CHUNK_LIMIT,
    ),
  );
  assert.equal(sections[0]!.start, 0);
  assert.equal(sections.at(-1)!.end, source.length);
  for (let index = 1; index < sections.length; index++) {
    assert.ok(sections[index]!.start < sections[index - 1]!.end);
  }
  assertCompleteSectionCoverage(sections, source.length);
});

void test("analysis formatting preserves late-section penalties and exact quotes", () => {
  const penalty =
    "the greater of $2,000 or 10 percent of the transaction value";
  const analysis: BillAnalysis = {
    sourceLength: 42_000,
    sourceHash: "a".repeat(64),
    sectionCount: 2,
    analyzedSectionIds: ["section-001", "section-002"],
    sections: [
      {
        sectionId: "section-001",
        locator: "SEC. 1. DEFINITIONS.",
        summary: "Defines the people and transactions covered by the bill.",
        substantive: true,
        findings: [],
      },
      {
        sectionId: "section-002",
        locator: "SEC. 9. PENALTIES.",
        summary: "Creates a monetary penalty for violations.",
        substantive: true,
        findings: [
          {
            category: "penalty",
            statement:
              "A violator must pay a monetary penalty based on a fixed minimum or a share of the transaction.",
            actors: ["violator"],
            affectedParties: ["covered person"],
            crossReferences: [],
            quote: { text: penalty, locator: "Sec. 9(a)" },
          },
        ],
      },
    ],
  };

  const formatted = formatBillAnalysis(analysis);
  assert.match(formatted, /SEC\. 9\. PENALTIES/);
  assert.match(formatted, /\[penalty\]/);
  assert.match(formatted, /greater of \$2,000 or 10 percent/);
});
