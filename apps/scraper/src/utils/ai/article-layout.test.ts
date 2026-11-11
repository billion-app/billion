import assert from "node:assert/strict";
import test from "node:test";

import type { ArticleSource, BillBrief } from "@acme/validators";
import {
  describeArticleLayoutCatalog,
  inferArticleLayout,
  resolveArticleBlocks,
  verifyArticleLayout,
} from "@acme/validators";

import {
  dropInvalidLayoutBlocks,
  dropUnrecognisedChangeKinds,
  parseBriefWithSectionRecovery,
  verifyBriefLayout,
} from "./bill-brief.js";

const change = (title: string) => ({
  kind: "requires" as const,
  title,
  before: "Employers decide for themselves today.",
  after: "Employers would have to act at set thresholds.",
});

const heat = [
  {
    label: "Breaks",
    value: "82°F heat index",
    note: "Proposed threshold for breaks.",
  },
  {
    label: "Cooling",
    value: "87°F heat index",
    note: "Proposed threshold for cooling.",
  },
  { label: "Exempt below", value: "15 minutes per hour" },
];

function source(overrides: Partial<BillBrief> = {}): BillBrief {
  return {
    summary:
      "Employers would give indoor workers cooled breaks once it gets hot inside.",
    hook: "If this becomes law, indoor workers would get cooled breaks at an 82°F heat index and active cooling at 87°F.",
    facts: heat,
    changes: [change("Cooled rest breaks at 82°F"), change("Cooling at 87°F")],
    affected: [
      {
        group: "Warehouse workers",
        takeaway: "Warehouse workers would get cooled breaks.",
        effect: "Clear triggers replace case-by-case judgment.",
        direction: "gains",
      },
    ],
    unknowns: ["The text does not say how heat must be measured."],
    terms: [
      { term: "Heat index", plain: "How hot the air feels to a person." },
    ],
    reading: [],
    ...overrides,
  };
}

const types = (layout: readonly { type: string }[]) =>
  layout.map((block) => block.type);

void test("a writer's composition is kept when it is honest", () => {
  const layout = [
    { type: "figure", visual: "scale", facts: [0, 1] },
    { type: "changes", display: "explorer", items: [1, 0] },
    { type: "figure", visual: "metrics", facts: [2] },
    { type: "affected" },
    { type: "unknowns" },
  ] as const;
  assert.deepEqual(verifyArticleLayout(layout, source()), layout);
});

void test("out-of-range and repeated references are dropped", () => {
  const verified = verifyArticleLayout(
    [
      { type: "changes", display: "map", items: [0, 0, 7, -1, 1.5] },
      { type: "changes", display: "explorer", items: [0] },
      { type: "figure", visual: "metrics", facts: [9] },
      { type: "affected" },
      { type: "unknowns" },
    ],
    source({ facts: [] }),
  );
  // Change 1 was never placed, so it joins the first changes block.
  assert.deepEqual(verified, [
    { type: "changes", display: "map", items: [0, 1] },
    { type: "affected" },
    { type: "unknowns" },
  ]);
});

void test("omitted changes, facts, groups and unknowns stay on the page", () => {
  const verified = verifyArticleLayout(
    [{ type: "figure", visual: "scale", facts: [0, 1] }],
    source(),
  );
  assert.deepEqual(verified, [
    { type: "changes", display: "explorer", items: [0, 1] },
    { type: "figure", visual: "scale", facts: [0, 1] },
    { type: "figure", visual: "metrics", facts: [2] },
    { type: "affected" },
    { type: "unknowns" },
  ]);
});

void test("a visual the facts cannot support is drawn as metrics", () => {
  const visualOf = (
    visual: string,
    facts: ArticleSource["facts"],
  ): string | undefined =>
    verifyArticleLayout(
      [{ type: "figure", visual, facts: facts.map((_, index) => index) }],
      source({ facts: [...facts] }),
    ).find((block) => block.type === "figure")?.visual;
  assert.equal(visualOf("scale", heat.slice(0, 2)), "scale");
  assert.equal(
    visualOf("scale", [{ label: "Grant", value: "$25,000" }]),
    "metrics",
  );
  assert.equal(
    visualOf("timeline", [
      { label: "Starts", value: "January 1, 2027" },
      { label: "Report", value: "July 1, 2028" },
    ]),
    "timeline",
  );
  assert.equal(
    visualOf("timeline", [{ label: "Starts", value: "January 1, 2027" }]),
    "metrics",
  );
  assert.equal(visualOf("chart", heat.slice(0, 2)), "metrics");
});

void test("empty and repeated singleton blocks are dropped; depth blocks are optional", () => {
  const verified = verifyArticleLayout(
    [
      { type: "changes", display: "explorer", items: [0, 1] },
      { type: "figure", visual: "scale", facts: [0, 1, 2] },
      { type: "context" },
      { type: "furtherReading" },
      { type: "unknowns" },
      { type: "unknowns" },
      { type: "affected" },
      { type: "invented" },
    ],
    source(),
  );
  // No history or reading exists; the glossary was omitted by choice.
  assert.deepEqual(types(verified), [
    "changes",
    "figure",
    "unknowns",
    "affected",
  ]);
});

void test("an inferred layout reproduces the fixed v8 order", () => {
  assert.deepEqual(types(inferArticleLayout(source())), [
    "changes",
    "figure",
    "affected",
    "unknowns",
    "glossary",
    "perspectives",
  ]);
});

void test("perspectives follow the lens, not the layout", () => {
  const withLayout = source({
    deepDive: {
      title: "Why heat thresholds matter",
      dek: "A short explanation of how heat triggers would work in practice.",
      body: "Body ".repeat(80),
    },
    layout: [
      { type: "changes", display: "explorer", items: [0, 1] },
      { type: "furtherReading" },
    ],
  });
  assert.deepEqual(types(resolveArticleBlocks(withLayout)), [
    "changes",
    "figure",
    "furtherReading",
    "affected",
    "unknowns",
  ]);
  const lensed = types(
    resolveArticleBlocks(withLayout, { perspectives: true }),
  );
  assert.equal(
    lensed.indexOf("perspectives"),
    lensed.indexOf("furtherReading") - 1,
  );
});

void test("resolution returns the referenced content in the writer's order", () => {
  const blocks = resolveArticleBlocks(
    source({
      layout: [{ type: "changes", display: "explorer", items: [1, 0] }],
    }),
  );
  const changes = blocks.find((block) => block.type === "changes");
  assert.deepEqual(
    changes?.type === "changes" && changes.items.map((item) => item.title),
    ["Cooling at 87°F", "Cooled rest breaks at 82°F"],
  );
});

void test("the writer's catalog is rendered from the schema descriptions", () => {
  const catalog = describeArticleLayoutCatalog();
  for (const type of ["changes", "figure", "unknowns", "perspectives"]) {
    assert.match(catalog, new RegExp(`"${type}":`));
  }
  assert.match(catalog, /'scale' places exactly two/);
});

void test("dropping an unrecognised change keeps layout references on the same changes", () => {
  const generated = {
    ...source(),
    changes: [
      change("First"),
      { ...change("Invented"), kind: "clarifies" },
      change("Third"),
    ],
    layout: [{ type: "changes", display: "explorer", items: [2, 1, 0] }],
  };
  const repaired = dropUnrecognisedChangeKinds(generated, "TEST 1") as {
    layout: { items: number[] }[];
  };
  assert.deepEqual(repaired.layout[0]?.items, [1, 0]);
});

void test("an invalid layout block costs only that block", () => {
  const generated = {
    ...source(),
    layout: [
      { type: "changes", display: "explorer", items: [0, 1] },
      { type: "chart", data: [1, 2] },
      { type: "figure", visual: "scale" },
      { type: "unknowns" },
    ],
  };
  const parsed = parseBriefWithSectionRecovery(
    dropInvalidLayoutBlocks(generated, "TEST 1"),
    "TEST 1",
  );
  assert.deepEqual(types(parsed.layout ?? []), ["changes", "unknowns"]);

  const unusable = parseBriefWithSectionRecovery(
    dropInvalidLayoutBlocks(
      { ...source(), layout: [{ type: "chart" }] },
      "TEST 1",
    ),
    "TEST 1",
  );
  // Readers infer a layout for a brief without one.
  assert.equal(unusable.layout, undefined);
});

void test("the stored layout matches the verified brief", () => {
  const verified = verifyBriefLayout(
    source({ layout: [{ type: "figure", visual: "timeline", facts: [0, 1] }] }),
    "TEST 1",
  );
  assert.deepEqual(verified.layout?.[1], {
    type: "figure",
    visual: "metrics",
    facts: [0, 1],
  });
  assert.equal(verifyBriefLayout(source(), "TEST 1").layout, undefined);
});

void test("a requested scale of two amounts of one quantity is kept", () => {
  const grants = [
    { label: "Standard grant", value: "$15,000 per residence" },
    { label: "Lower-income households", value: "$25,000 per residence" },
  ];
  const layout = [{ type: "figure", visual: "scale", facts: [0, 1] }] as const;
  assert.equal(
    verifyArticleLayout(layout, source({ facts: grants })).find(
      (block) => block.type === "figure",
    )?.visual,
    "scale",
  );
  // Inference never draws a quantity scale on its own.
  assert.equal(
    inferArticleLayout(source({ facts: grants })).find(
      (block) => block.type === "figure",
    )?.visual,
    "metrics",
  );
});
