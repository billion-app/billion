import assert from "node:assert/strict";
import test from "node:test";

import type { TranslateBatch } from "./content-translation";
import {
  applySegments,
  BILL_BRIEF_FIELDS,
  collectSegments,
  hashSegments,
  sourceSegments,
  splitIntoPieces,
  translateSegments,
} from "./content-translation";

const brief = {
  summary: "Gives states **ten years** of road money.",
  hook: "Funding for roads.",
  facts: [
    {
      label: "Funding",
      value: "$1.2B",
      quote: { text: "There is authorized $1,200,000,000", locator: "Sec. 2" },
    },
  ],
  changes: [
    {
      kind: "creates",
      title: "Road money for states",
      before: "States apply each year.",
      after: "States get a fixed share.",
      quote: { text: "shall apportion", locator: "Sec. 3(a)" },
      imageUri: "data:image/png;base64,AAAA",
    },
  ],
  affected: [],
  unknowns: ["Who decides the formula?"],
  terms: [],
  reading: [
    {
      title: "A Real Headline",
      publisher: "The Paper",
      url: "https://example.com/a",
      whyRead: "Explains the formula.",
    },
  ],
};

const upper: TranslateBatch = (texts) =>
  Promise.resolve(texts.map((text) => text.toUpperCase()));

void test("collects authored prose but never quotes, urls, or headlines", () => {
  const keys = collectSegments(brief, BILL_BRIEF_FIELDS, "brief").map(
    (segment) => segment.key,
  );
  assert.deepEqual(keys, [
    "brief.summary",
    "brief.hook",
    "brief.facts.0.label",
    "brief.facts.0.value",
    "brief.changes.0.title",
    "brief.changes.0.before",
    "brief.changes.0.after",
    "brief.unknowns.0",
    "brief.reading.0.whyRead",
  ]);
});

void test("applies translations without touching source fields", async () => {
  const segments = collectSegments(brief, BILL_BRIEF_FIELDS, "brief");
  const translated = applySegments(
    brief,
    await translateSegments(segments, "es", upper),
    "brief",
  );
  assert.equal(translated.changes[0]?.title, "ROAD MONEY FOR STATES");
  assert.equal(translated.unknowns[0], "WHO DECIDES THE FORMULA?");
  assert.deepEqual(translated.changes[0]?.quote, brief.changes[0]?.quote);
  assert.equal(translated.changes[0]?.imageUri, brief.changes[0]?.imageUri);
  assert.equal(translated.reading[0]?.title, "A Real Headline");
  assert.equal(translated.reading[0]?.url, "https://example.com/a");
  // The English input is not mutated.
  assert.equal(brief.changes[0]?.title, "Road money for states");
});

void test("skips paths that no longer exist instead of creating them", () => {
  const result = applySegments(
    { unknowns: ["one"] },
    { "brief.unknowns.3": "tres", "brief.missing.x": "y" },
    "brief",
  );
  assert.deepEqual(result, { unknowns: ["one"] });
});

void test("omits the explainer when it is source text", () => {
  const keys = sourceSegments({
    title: "T",
    description: "D",
    articleContent: null,
    brief: null,
    courtBrief: null,
  }).map((segment) => segment.key);
  assert.deepEqual(keys, ["title", "description"]);
});

void test("splits long markdown on paragraphs and reassembles it", async () => {
  const paragraph = "word ".repeat(300).trim();
  const body = [paragraph, paragraph, paragraph].join("\n\n");
  const segments = [{ key: "articleContent", text: body }];
  assert.ok(splitIntoPieces(segments).length > 1);
  const out = await translateSegments(segments, "zh", upper);
  assert.equal(out.articleContent, body.toUpperCase());
});

void test("rejects a batch that drops items", async () => {
  await assert.rejects(
    translateSegments(
      [
        { key: "title", text: "a" },
        { key: "description", text: "b" },
      ],
      "es",
      () => Promise.resolve(["solo"]),
    ),
  );
});

void test("hash changes when English text changes", () => {
  const a = hashSegments([{ key: "title", text: "A" }]);
  const b = hashSegments([{ key: "title", text: "B" }]);
  assert.notEqual(a, b);
});
