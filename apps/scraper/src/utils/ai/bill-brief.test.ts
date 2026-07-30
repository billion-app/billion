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
  dropUncitedContextPoints,
  dropUnrecognisedChangeKinds,
  findLoadedLanguage,
  findMissingEmphasis,
  findUnexplainedJargon,
  GeneratedBriefQuoteSchema,
  isQuoteGrounded,
  normalizeForQuoteMatch,
  truncateOverlongLists,
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
  const v6 = { ...brief(), ...metadata, version: 6 };

  assert.equal(isUsableBillBrief(v5), true);
  assert.equal(isCurrentBillBrief(v5), false);
  assert.equal(parseBillBriefRecord(v5)?.version, BILL_BRIEF_VERSION);
  assert.equal(isUsableBillBrief(v6), true);
  assert.equal(isCurrentBillBrief(v6), false);
  assert.equal(parseBillBriefRecord(v6)?.version, BILL_BRIEF_VERSION);

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

void test("brief-wide emphasis lint names every prose field that needs revision", () => {
  const missing = findMissingEmphasis(brief());

  assert.ok(missing.includes("hook"));
  assert.ok(missing.includes("changes[0].before"));
  assert.ok(missing.includes("affected[0].takeaway"));
  assert.ok(missing.includes("unknowns[0]"));

  const emphasized = brief({
    hook: "The bill would let the Secretary **skip environmental reviews** for covered projects when an operational deadline is at risk.",
    changes: [
      {
        kind: "waives",
        title: "Environmental review can be skipped",
        before:
          "Covered projects must **complete an environmental review** under current law.",
        after:
          "The Secretary could **waive that review** to meet an operational deadline.",
      },
    ],
    affected: [
      {
        group: "Communities near covered projects",
        takeaway:
          "Nearby communities would **lose a required opportunity for public comment**.",
        effect:
          "They would **lose the public comment step** that the review process provides.",
        direction: "loses",
      },
    ],
    unknowns: [
      "The text does not define **what counts as an operational deadline**.",
    ],
  });
  assert.deepEqual(findMissingEmphasis(emphasized), []);
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

/* ---------- transport shapes that must not cost a brief ---------- */

test("a quote sent as a bare string is accepted and wrapped", () => {
  // 68 failures came from this shape. The text is what gets verified against
  // the source, so the missing envelope costs nothing.
  const parsed = GeneratedBriefQuoteSchema.parse(
    "A State shall not establish lifetime or annual limits",
  );
  assert.deepEqual(parsed, {
    text: "A State shall not establish lifetime or annual limits",
  });
});

test("a quote sent as an object still parses, locator and all", () => {
  const parsed = GeneratedBriefQuoteSchema.parse({
    text: "shall waive the requirement described in paragraph (1)",
    locator: "SEC. 3(a)(2)",
  });
  assert.deepEqual(parsed, {
    text: "shall waive the requirement described in paragraph (1)",
    locator: "SEC. 3(a)(2)",
  });
});

test("a null locator survives the union", () => {
  const parsed = GeneratedBriefQuoteSchema.parse({
    text: "an email to each enrolled student at least once each academic year",
    locator: null,
  });
  assert.equal(
    (parsed as { text: string }).text,
    "an email to each enrolled student at least once each academic year",
  );
});

test("a change with an invented kind is dropped, the valid ones survive", () => {
  // H.Res. 1174's shape: "clarifies" for one change lost the other three.
  const cleaned = dropUnrecognisedChangeKinds(
    {
      changes: [
        { kind: "creates", title: "one" },
        { kind: "clarifies", title: "invented" },
        { kind: "restricts", title: "three" },
      ],
    },
    "H.Res. 1174",
  ) as { changes: { kind: string }[] };

  assert.deepEqual(
    cleaned.changes.map((c) => c.kind),
    ["creates", "restricts"],
  );
});

test("a brief with only valid kinds is returned untouched", () => {
  const input = { changes: [{ kind: "funds", title: "one" }] };
  assert.equal(dropUnrecognisedChangeKinds(input, "S. 1"), input);
});

test("dropping every change leaves an empty list for the schema to reject", () => {
  // Deliberately not an error here: BillBriefSchema's min(1) is what refuses a
  // brief with nothing in "What would change".
  const cleaned = dropUnrecognisedChangeKinds(
    { changes: [{ kind: "clarifies", title: "only" }] },
    "S. 2",
  ) as { changes: unknown[] };
  assert.equal(cleaned.changes.length, 0);
});

test("a payload without a changes array is passed through", () => {
  const input = { hook: "no changes key" };
  assert.equal(dropUnrecognisedChangeKinds(input, "S. 3"), input);
});

test("an over-long list is trimmed rather than costing the brief", () => {
  // S. 4238 returned four unknowns against a maximum of three.
  const cleaned = truncateOverlongLists(
    { unknowns: ["one", "two", "three", "four"] },
    "S. 4238",
  ) as { unknowns: string[] };
  assert.deepEqual(cleaned.unknowns, ["one", "two", "three"]);
});

test("lists within their caps are returned untouched", () => {
  const input = { unknowns: ["one"], facts: [1, 2, 3, 4] };
  assert.equal(truncateOverlongLists(input, "S. 1"), input);
});

test("trimming keeps the earliest items, which the model ranks first", () => {
  const cleaned = truncateOverlongLists(
    { terms: ["a", "b", "c", "d", "e", "f", "g"] },
    "S. 2",
  ) as { terms: string[] };
  assert.deepEqual(cleaned.terms, ["a", "b", "c", "d", "e"]);
});

test("trimming and kind-dropping compose in the order the pipeline applies them", () => {
  // Invalid kinds go first, so a valid change is never dropped in favour of an
  // invalid one when the list is then capped at five.
  const changes = [
    { kind: "clarifies", title: "invalid" },
    { kind: "creates", title: "1" },
    { kind: "creates", title: "2" },
    { kind: "creates", title: "3" },
    { kind: "creates", title: "4" },
    { kind: "creates", title: "5" },
  ];
  const cleaned = truncateOverlongLists(
    dropUnrecognisedChangeKinds({ changes }, "S. 3"),
    "S. 3",
  ) as { changes: { title: string }[] };
  assert.deepEqual(
    cleaned.changes.map((c) => c.title),
    ["1", "2", "3", "4", "5"],
  );
});

test("an uncited context point is dropped, cited ones survive", () => {
  // H.R. 8244's shape: citations arrived empty and the whole brief was rejected
  // before verifyBriefContext could drop just that point.
  const cleaned = dropUncitedContextPoints(
    {
      whyNotBefore: {
        summary: "s",
        points: [
          { text: "uncited", citations: [] },
          { text: "cited", citations: [{ url: "https://example.com" }] },
        ],
      },
    },
    "H.R. 8244",
  ) as { whyNotBefore: { points: { text: string }[] } };

  assert.deepEqual(
    cleaned.whyNotBefore.points.map((p) => p.text),
    ["cited"],
  );
});

test("whyNotBefore is removed entirely when every point is uncited", () => {
  const cleaned = dropUncitedContextPoints(
    { hook: "h", whyNotBefore: { summary: "s", points: [{ citations: [] }] } },
    "S. 1",
  ) as Record<string, unknown>;
  assert.equal("whyNotBefore" in cleaned, false);
  assert.equal(cleaned.hook, "h");
});

test("a fully cited context section is returned untouched", () => {
  const input = {
    whyNotBefore: {
      summary: "s",
      points: [{ citations: [{ url: "https://example.com" }] }],
    },
  };
  assert.equal(dropUncitedContextPoints(input, "S. 2"), input);
});

test("a brief with no whyNotBefore is passed through", () => {
  const input = { hook: "h" };
  assert.equal(dropUncitedContextPoints(input, "S. 3"), input);
});
