import assert from "node:assert/strict";
import test from "node:test";

import type { BillBrief } from "@acme/validators";
import {
  BILL_BRIEF_VERSION,
  isCurrentBillBrief,
  isUsableBillBrief,
  parseBillBriefRecord,
} from "@acme/validators";

import {
  deriveLegalStatus,
  findLoadedLanguage,
  findUnexplainedJargon,
  isQuoteGrounded,
  normalizeForQuoteMatch,
  verifyBriefContext,
  verifyBriefQuotes,
  verifyBriefReading,
} from "./bill-brief.js";

const SOURCE = `
SEC. 4. WAIVER OF ENVIRONMENTAL REVIEW.

  (a) In general.--The Secretary may waive the requirements of section
102(2)(C) of the National Environmental Policy Act of 1969 with respect
to any covered project, if the Secretary determines that the waiver is
necessary to meet an operational deadline.

  (b) Authorization of appropriations.--There is authorized to be
appropriated $1,200,000,000 for fiscal year 2027 to carry out this
section.
`;

function brief(overrides: Partial<BillBrief> = {}): BillBrief {
  return {
    hook: "The bill would let the Secretary skip environmental reviews for covered projects when an operational deadline is at risk. The text does not define which deadlines would qualify.",
    facts: [
      {
        label: "Authorized funding",
        value: "$1.2B",
        note: "For fiscal year 2027.",
      },
    ],
    changes: [
      {
        kind: "waives",
        title: "Environmental review can be skipped",
        before:
          "Covered projects must complete a review under the National Environmental Policy Act.",
        after:
          "The Secretary would be able to waive that review to meet an operational deadline.",
      },
    ],
    affected: [
      {
        group: "Communities near covered projects",
        takeaway:
          "Nearby communities would lose a required opportunity for public comment.",
        effect:
          "They would lose the public comment step that the review process provides.",
        direction: "loses",
      },
    ],
    unknowns: [
      "The text does not define what counts as an operational deadline.",
    ],
    terms: [],
    reading: [],
    ...overrides,
  };
}

void test("older brief records stay renderable but are not current cache hits", () => {
  const metadata = {
    legalStatus: "proposed" as const,
    verifiedQuotes: 0,
    generatedAt: "2026-07-26T00:00:00.000Z",
    modelVersion: "legacy-model",
  };
  const v5 = { ...brief(), ...metadata, version: 5 };

  assert.equal(isUsableBillBrief(v5), true);
  assert.equal(isCurrentBillBrief(v5), false);
  assert.equal(parseBillBriefRecord(v5)?.version, BILL_BRIEF_VERSION);

  const current = {
    ...v5,
    version: BILL_BRIEF_VERSION,
  };
  assert.equal(isCurrentBillBrief(current), true);
});

void test("v1 briefs receive client defaults at the API boundary", () => {
  const current = brief();
  const v1 = {
    version: 1,
    hook: current.hook,
    facts: current.facts,
    changes: current.changes,
    affected: current.affected.map(({ takeaway: _takeaway, ...item }) => item),
    unknowns: current.unknowns,
    terms: current.terms,
    sections: [],
    legalStatus: "proposed" as const,
    verifiedQuotes: 0,
    generatedAt: "2026-07-26T00:00:00.000Z",
    modelVersion: "legacy-model",
  };
  const normalized = parseBillBriefRecord(v1);

  assert.equal(normalized?.version, BILL_BRIEF_VERSION);
  assert.deepEqual(normalized?.reading, []);
  assert.equal(normalized?.affected[0]?.takeaway, current.affected[0]?.effect);
});

void test("further reading keeps only URLs found by the research loop", () => {
  const result = verifyBriefReading(
    brief({
      reading: [
        {
          title: "A useful researched explainer",
          publisher: "Congressional Research Service",
          url: "https://example.com/researched/",
          whyRead:
            "It explains how Congress turns a spending limit into money.",
        },
        {
          title: "A convincing but invented article",
          publisher: "Made Up News",
          url: "https://example.com/invented",
          whyRead:
            "The model created this URL, so readers should never see it.",
        },
      ],
    }),
    [
      {
        id: 1,
        title: "Researched source",
        url: "https://example.com/researched",
      },
    ],
  );

  assert.deepEqual(
    result.reading.map((item) => item.url),
    ["https://example.com/researched"],
  );
});

void test("historical context requires two opened research sources", () => {
  const researched = [
    {
      id: 1,
      title: "First opened source",
      url: "https://example.com/first",
    },
    {
      id: 2,
      title: "Second opened source",
      url: "https://example.com/second",
    },
  ];
  const result = verifyBriefContext(
    brief({
      whyNotBefore: {
        summary:
          "Earlier proposals stalled because lawmakers had not resolved two separate implementation questions.",
        points: [
          {
            text: "The first documented disagreement concerned which existing rules the proposal would replace.",
            citations: [
              {
                title: "First opened source",
                publisher: "Research Office",
                url: "https://example.com/first/",
              },
              {
                title: "Invented source",
                publisher: "Made Up News",
                url: "https://example.com/invented",
              },
            ],
          },
          {
            text: "A second source documents a separate disagreement over how the new rule would be enforced.",
            citations: [
              {
                title: "Second opened source",
                publisher: "Research Office",
                url: "https://example.com/second",
              },
            ],
          },
        ],
      },
    }),
    researched,
  );

  assert.deepEqual(
    result.whyNotBefore?.points.flatMap((point) =>
      point.citations.map((citation) => citation.url),
    ),
    ["https://example.com/first", "https://example.com/second"],
  );

  const underSourced = verifyBriefContext(
    brief({
      whyNotBefore: {
        summary:
          "One opened page alone is not enough to support this historical explanation.",
        points: [
          {
            text: "This claim has only one source, so the whole optional section should be removed.",
            citations: [
              {
                title: "First opened source",
                publisher: "Research Office",
                url: "https://example.com/first",
              },
            ],
          },
        ],
      },
    }),
    researched,
  );
  assert.equal(underSourced.whyNotBefore, undefined);
});

void test("quote matching ignores whitespace, case, and smart punctuation", () => {
  const normalized = normalizeForQuoteMatch(SOURCE);
  assert.equal(
    isQuoteGrounded(
      "The Secretary may waive the requirements of section 102(2)(C)",
      normalized,
    ),
    true,
  );
  // Wrapped across a newline in the source, and re-typed with curly quotes.
  assert.equal(
    isQuoteGrounded(
      "if the Secretary determines that the waiver is necessary",
      normalized,
    ),
    true,
  );
});

void test("quote matching rejects paraphrase and reordered words", () => {
  const normalized = normalizeForQuoteMatch(SOURCE);
  assert.equal(
    isQuoteGrounded(
      "The Secretary is allowed to waive environmental review requirements",
      normalized,
    ),
    false,
  );
  assert.equal(
    isQuoteGrounded(
      "may waive the requirements of the National Environmental Policy Act of 1969",
      normalized,
    ),
    false,
  );
  // Too short to be meaningful once normalized.
  assert.equal(isQuoteGrounded("the Secretary", normalized), false);
});

void test("verification strips unverified quotes but keeps the claim", () => {
  const input = brief({
    facts: [
      {
        label: "Authorized funding",
        value: "$1.2B",
        quote: { text: "appropriated $1,200,000,000 for fiscal year 2027" },
      },
    ],
    changes: [
      {
        kind: "waives",
        title: "Environmental review can be skipped",
        before: "Covered projects must complete a review.",
        after: "The Secretary would be able to waive that review.",
        quote: {
          text: "The Secretary shall have unlimited authority to ignore all federal law",
          locator: "Sec. 4(a)",
        },
      },
    ],
  });

  const {
    brief: cleaned,
    verified,
    dropped,
  } = verifyBriefQuotes(input, SOURCE);
  assert.equal(verified, 1);
  assert.equal(dropped, 1);
  assert.ok(cleaned.facts[0]?.quote, "grounded quote is kept");
  assert.equal(cleaned.changes[0]?.quote, undefined, "invented quote is gone");
  assert.equal(
    cleaned.changes[0]?.title,
    "Environmental review can be skipped",
    "the surrounding claim survives",
  );
});

void test("framing lint flags loaded language in the model's own voice", () => {
  assert.deepEqual(findLoadedLanguage(brief()), []);

  const loaded = findLoadedLanguage(
    brief({
      hook: "This common sense bill guts a burdensome review requirement.",
      unknowns: ["Whether this radical shift survives review."],
    }),
  );
  assert.deepEqual(loaded.sort(), [
    "burdensome",
    "common sense",
    "guts",
    "radical",
  ]);
});

void test("framing lint exempts verbatim quotes from the source", () => {
  // A sponsor calling their own bill "common sense" is reportable; repeating it
  // inside a quote must not trip the lint.
  const withLoadedQuote = brief({
    changes: [
      {
        kind: "waives",
        title: "Environmental review can be skipped",
        before: "Covered projects must complete a review.",
        after: "The Secretary would be able to waive that review.",
        quote: {
          text: "this common sense reform cuts red tape for job-killing delays",
        },
      },
    ],
  });
  assert.deepEqual(findLoadedLanguage(withLoadedQuote), []);
});

void test("plain-language lint flags unexplained policy jargon", () => {
  const jargonBrief = brief({
    facts: [],
    changes: [
      {
        kind: "funds",
        title: "Road funding changes",
        before:
          "Cities currently compete through discretionary federal grants.",
        after:
          "States would receive a longer funding horizon under the proposal.",
      },
    ],
  });

  assert.deepEqual(findUnexplainedJargon(jargonBrief), [
    "funding horizon",
    "discretionary grant",
  ]);
});

void test("plain-language lint allows an essential term defined up front", () => {
  const definedBrief = brief({
    changes: [
      {
        kind: "funds",
        title: "Congress sets a spending limit",
        before: "Congress currently approves the program for a shorter period.",
        after: "The bill would create a ten-year authorization.",
      },
    ],
    terms: [
      {
        term: "Authorization",
        plain:
          "Congress allows a program to spend up to a limit but does not provide the money yet.",
      },
    ],
  });

  assert.deepEqual(findUnexplainedJargon(definedBrief), []);
});

void test("legal status comes from the scraped status string", () => {
  assert.equal(deriveLegalStatus("Became Public Law No: 118-42"), "enacted");
  assert.equal(deriveLegalStatus("Signed by President"), "enacted");
  assert.equal(deriveLegalStatus("Introduced"), "proposed");
  assert.equal(deriveLegalStatus("Passed House"), "proposed");
  assert.equal(deriveLegalStatus(null), "proposed");
});
