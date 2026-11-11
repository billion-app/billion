import assert from "node:assert/strict";
import { test } from "node:test";

import { BillArticleSchema } from "@acme/validators";

import type { ArticleBlockOf } from "./bill-article";
import type { BillBriefData } from "./BillBrief";
import {
  billArticleFromBrief,
  figureForBlock,
  figureShowsTimeline,
} from "./bill-article";

const change = {
  kind: "requires" as const,
  title: "Cooled rest breaks at 82°F",
  before: "Indoor heat rules are less specific.",
  after: "Employers would provide cooled rest periods.",
};

const brief = (overrides: Partial<BillBriefData> = {}): BillBriefData => ({
  summary:
    "Employers would give indoor workers cooled breaks once it gets hot inside.",
  hook: "If this becomes law, indoor workers would get cooled breaks at an 82°F heat index and active cooling at 87°F.",
  legalStatus: "proposed",
  facts: [],
  changes: [change],
  affected: [
    {
      group: "Warehouse workers",
      takeaway: "Warehouse workers would get cooled breaks.",
      effect: "Clear triggers replace case-by-case judgment.",
      direction: "gains",
    },
  ],
  unknowns: ["The text does not say how heat must be measured."],
  terms: [{ term: "Heat index", plain: "How hot the air feels to a person." }],
  reading: [],
  ...overrides,
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
];

test("a v8 brief keeps its reading order as blocks", () => {
  const article = billArticleFromBrief(
    brief({
      facts: [{ label: "Share", value: "20%" }],
      whyNotBefore: {
        summary: "Earlier proposals stalled over enforcement costs.",
        points: [
          {
            text: "Earlier versions stalled in committee over who would pay for enforcement.",
            citations: [
              {
                title: "Committee analysis",
                publisher: "Senate",
                url: "https://example.com/analysis",
              },
            ],
          },
        ],
      },
      deepDive: { title: "Why heat", dek: "A short dek.", body: "Body." },
    }),
    { perspectives: true },
  );
  assert.deepEqual(
    article.blocks.map((block) => block.type),
    [
      "changes",
      "figure",
      "affected",
      "unknowns",
      "glossary",
      "context",
      "perspectives",
      "furtherReading",
    ],
  );
});

test("empty brief sections produce no blocks", () => {
  const article = billArticleFromBrief(
    brief({ affected: [], terms: [], facts: [] }),
  );
  assert.deepEqual(
    article.blocks.map((block) => block.type),
    ["changes", "unknowns"],
  );
});

test("the inferred visual is recorded on the figure block", () => {
  const visualOf = (facts: BillBriefData["facts"]) =>
    billArticleFromBrief(brief({ facts })).blocks.find(
      (block): block is ArticleBlockOf<"figure"> => block.type === "figure",
    )?.visual;
  assert.equal(visualOf(heat), "scale");
  assert.equal(
    visualOf([
      { label: "Starts", value: "January 1, 2027" },
      { label: "Report", value: "July 1, 2028" },
    ]),
    "timeline",
  );
  assert.equal(visualOf([{ label: "Share", value: "20%" }]), "metrics");
});

test("changes use the map exactly when no figure anchors the opening", () => {
  const displayOf = (facts: BillBriefData["facts"]) =>
    billArticleFromBrief(brief({ facts })).blocks.find(
      (block): block is ArticleBlockOf<"changes"> => block.type === "changes",
    )?.display;
  assert.equal(displayOf([]), "map");
  assert.equal(displayOf([{ label: "Share", value: "20%" }]), "explorer");
  assert.equal(displayOf(heat), "explorer");
});

test("a requested visual is drawn only when its facts support it", () => {
  const figure = (
    visual: ArticleBlockOf<"figure">["visual"],
    facts: BillBriefData["facts"],
  ): ArticleBlockOf<"figure"> => ({ type: "figure", visual, facts });

  assert.equal(figureForBlock(figure("scale", heat))?.kind, "temperature");
  // Thresholds the writer chose to show as metrics are not forced onto a scale.
  assert.equal(figureForBlock(figure("metrics", heat))?.kind, "metrics");
  // A scale request without comparable values degrades to metrics.
  assert.equal(
    figureForBlock(figure("scale", [{ label: "Grant", value: "$25,000" }]))
      ?.kind,
    "metrics",
  );

  const dates = [
    { label: "Starts", value: "January 1, 2027" },
    { label: "Report", value: "July 1, 2028" },
  ];
  assert.equal(figureShowsTimeline(figure("timeline", dates)), true);
  assert.equal(figureShowsTimeline(figure("metrics", dates)), false);
  assert.equal(
    figureShowsTimeline(figure("timeline", dates.slice(0, 1))),
    false,
  );
});

test("adapted articles satisfy the shared article catalog", () => {
  const {
    sourceStatus: _status,
    sourceLabel: _label,
    ...article
  } = billArticleFromBrief(
    brief({
      facts: heat,
      sourceStatus: "Passed Senate",
      sourceLabel: "CA SB 1207",
    }),
    { perspectives: true },
  );
  assert.equal(BillArticleSchema.safeParse(article).success, true);
});

test("a v9 brief renders the writer's layout instead of the inferred order", () => {
  const article = billArticleFromBrief(
    brief({
      facts: heat,
      layout: [
        { type: "figure", visual: "scale", facts: [0, 1] },
        { type: "changes", display: "explorer", items: [0] },
        { type: "unknowns" },
        { type: "affected" },
      ],
    }),
  );
  assert.deepEqual(
    article.blocks.map((block) => block.type),
    ["figure", "changes", "unknowns", "affected"],
  );
});
