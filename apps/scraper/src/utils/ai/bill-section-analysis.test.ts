import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSectionAnalysisPrompt,
  chunkSectionForAnalysis,
  conservativeTokenUpperBound,
  formatSectionAnalysesForWriting,
  normalizeSectionNotes,
} from "./bill-section-analysis.js";

const HASH = "a".repeat(64);

function section(text: string) {
  return {
    id: "section-id",
    structuralPath: "title-i/section-4",
    heading: "Penalties",
    displayedNumber: "SEC. 4.",
    order: 3,
    text,
    sectionHash: HASH,
    sourceStartOffset: 100,
    sourceEndOffset: 100 + text.length,
  };
}

void test("large canonical sections are chunked without crossing the input budget", () => {
  const source = Array.from(
    { length: 300 },
    (_, index) =>
      `(a) Rule ${index}. A covered person shall pay a civil penalty of $2,000.\n\n`,
  ).join("");
  const inputBudget = 2_400;
  const chunks = chunkSectionForAnalysis(section(source), inputBudget);

  assert.ok(chunks.length > 1);
  assert.equal(chunks.map((chunk) => chunk.text).join(""), source);
  for (const chunk of chunks) {
    const prompt = buildSectionAnalysisPrompt({
      section: section(source),
      excerpt: chunk.text,
      excerptStartOffset: chunk.startOffset,
    });
    assert.ok(conservativeTokenUpperBound(prompt) <= inputBudget);
  }
});

void test("evidence is grounded and rewritten to canonical section offsets", () => {
  const prefix = "Introductory language. ";
  const quote = "The violator shall pay a civil penalty of $2,000.";
  const chunk = { text: `${prefix}${quote}`, startOffset: 500 };
  const notes = normalizeSectionNotes(
    {
      summary: "Creates a civil penalty.",
      provisions: [
        {
          kind: "penalty",
          statement: "Violators face a $2,000 civil penalty.",
          subjects: ["violators"],
          evidence: [{ quote, startOffset: 0, endOffset: 4 }],
        },
      ],
    },
    chunk,
    HASH,
  );

  assert.deepEqual(notes.provisions[0]?.evidence[0], {
    quote,
    sectionHash: HASH,
    startOffset: 500 + prefix.length,
    endOffset: 500 + prefix.length + quote.length,
  });
});

void test("ungrounded evidence cannot survive into cached notes", () => {
  const notes = normalizeSectionNotes(
    {
      summary: "The model invented a penalty.",
      provisions: [
        {
          kind: "penalty",
          statement: "Violators face a penalty.",
          subjects: ["violators"],
          evidence: [
            {
              quote: "This sentence is not in the section.",
              startOffset: 0,
              endOffset: 36,
            },
          ],
        },
      ],
    },
    { text: "The section contains definitions only.", startOffset: 0 },
    HASH,
  );

  assert.deepEqual(notes.provisions, []);
});

void test("late H.R. 7008 penalties remain visible to the writing pass", () => {
  const penaltyText =
    "the greater of $2,000 or 10 percent of the value of the transaction, plus the net gain";
  const penaltySection = section(penaltyText);
  const writingInput = formatSectionAnalysesForWriting([
    {
      section: penaltySection,
      status: "analyzed",
      notes: {
        summary:
          "Creates a civil penalty that cannot be paid from campaign funds.",
        provisions: [
          {
            kind: "penalty",
            statement:
              "The penalty is the greater of $2,000 or 10% of transaction value, plus net gain, and campaign funds may not pay it.",
            subjects: ["covered officeholders"],
            evidence: [
              {
                quote: penaltyText,
                sectionHash: HASH,
                startOffset: 0,
                endOffset: penaltyText.length,
              },
            ],
          },
        ],
      },
      error: null,
    },
  ]);

  assert.match(writingInput, /greater of \$2,000 or 10%/);
  assert.match(writingInput, /campaign funds may not pay it/);
  assert.match(writingInput, new RegExp(`${HASH}:0-${penaltyText.length}`));
});
