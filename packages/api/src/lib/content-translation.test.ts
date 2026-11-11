import assert from "node:assert/strict";
import test from "node:test";
import { MockLanguageModelV3 } from "ai/test";

import type { TranslateBatch } from "./content-translation";
import {
  applySegments,
  BILL_BRIEF_FIELDS,
  collectSegments,
  createTranslateBatch,
  hashReaderSource,
  hashSegments,
  readerTranslationSource,
  sourceSegments,
  splitIntoPieces,
  translateSegments,
} from "./content-translation";

const brief = {
  headline: "Ten years of road funding for states",
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
      reader: {
        summary: "States would get a predictable share of road money.",
        question: "How would the money be divided?",
        answer: "The source leaves the exact split to a later decision.",
        quote: {
          text: "The agency shall determine the allocation.",
          locator: "Sec. 3(b)",
        },
      },
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

void test("collects authored prose but never quotes, urls, or cited headlines", () => {
  const keys = collectSegments(brief, BILL_BRIEF_FIELDS, "brief").map(
    (segment) => segment.key,
  );
  assert.deepEqual(keys, [
    "brief.headline",
    "brief.summary",
    "brief.hook",
    "brief.facts.0.label",
    "brief.facts.0.value",
    "brief.changes.0.title",
    "brief.changes.0.before",
    "brief.changes.0.after",
    "brief.changes.0.reader.summary",
    "brief.changes.0.reader.question",
    "brief.changes.0.reader.answer",
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
  const [change] = translated.changes;
  const [original] = brief.changes;
  const [reading] = translated.reading;
  assert.ok(change && original && reading);
  assert.equal(translated.headline, "TEN YEARS OF ROAD FUNDING FOR STATES");
  assert.equal(change.title, "ROAD MONEY FOR STATES");
  assert.equal(change.reader.question, "HOW WOULD THE MONEY BE DIVIDED?");
  assert.equal(change.reader.summary, original.reader.summary.toUpperCase());
  assert.equal(change.reader.answer, original.reader.answer.toUpperCase());
  assert.equal(translated.unknowns[0], "WHO DECIDES THE FORMULA?");
  assert.deepEqual(change.quote, original.quote);
  assert.deepEqual(change.reader.quote, original.reader.quote);
  assert.equal(change.imageUri, original.imageUri);
  assert.equal(reading.title, "A Real Headline");
  assert.equal(reading.url, "https://example.com/a");
  // The English input is not mutated.
  assert.equal(original.title, "Road money for states");
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

void test("preserves Markdown quotes, cited headlines, and URLs exactly", async () => {
  const body =
    "An explanation.\n\n> shall provide notice\nlazy continuation\n\nSee [A Real Headline](https://example.com/MixedCase). The source says “shall apply”.";
  const out = await translateSegments(
    [{ key: "articleContent", text: body }],
    "es",
    upper,
  );
  assert.equal(
    out.articleContent,
    "AN EXPLANATION.\n\n> shall provide notice\nlazy continuation\n\nSEE [A Real Headline](https://example.com/MixedCase). THE SOURCE SAYS “shall apply”.",
  );
});

void test("rejects translations that lose protected source passages", async () => {
  await assert.rejects(
    translateSegments(
      [{ key: "brief.deepDive.body", text: "Explanation.\n\n> source quote" }],
      "zh",
      (texts) =>
        Promise.resolve(texts.map(() => "translation without the quote")),
    ),
  );
});

void test("client revision changes with source quotes while prose can reuse its translation", () => {
  const original = readerTranslationSource({
    title: "T",
    description: "D",
    articleContent: "Explanation",
    originalContent: "Original",
    brief,
  });
  const changed = structuredClone(original);
  changed.brief = {
    ...brief,
    changes: [
      {
        ...brief.changes[0],
        quote: { text: "a different source passage", locator: "Sec. 4" },
      },
    ],
  };
  assert.notEqual(hashReaderSource(original), hashReaderSource(changed));
  assert.equal(
    hashSegments(sourceSegments(original)),
    hashSegments(sourceSegments(changed)),
  );
  const sourceOnly = readerTranslationSource({
    title: "T",
    description: "D",
    articleContent: "Original",
    originalContent: "Original",
  });
  assert.equal(sourceOnly.articleContent, null);
});

void test("rejects duplicate source placeholders and empty translations", async () => {
  await assert.rejects(
    translateSegments(
      [{ key: "articleContent", text: "> original" }],
      "es",
      (texts) => Promise.resolve(texts.map((text) => text + text)),
    ),
  );
  await assert.rejects(
    translateSegments([{ key: "title", text: "A title" }], "es", () =>
      Promise.resolve([" "]),
    ),
  );
});

void test("protected source passages cannot move to another field", async () => {
  await assert.rejects(
    translateSegments(
      [
        { key: "title", text: "The source says “original wording”" },
        { key: "articleContent", text: "An explanation" },
      ],
      "es",
      (texts) => Promise.resolve([...texts].reverse()),
    ),
  );
});

void test("wrapped quotations and reference headlines remain verbatim", async () => {
  const original =
    "Explanation: “first line\nsecond line”. See [Real Headline][source].";
  const out = await translateSegments(
    [{ key: "articleContent", text: original }],
    "zh",
    upper,
  );
  assert.equal(
    out.articleContent,
    "EXPLANATION: “first line\nsecond line”. SEE [Real Headline][source].",
  );
});

for (const cause of ["shutdown", "deadline"] as const) {
  void test(`translation generation aborts on ${cause}`, async (t) => {
    const shutdown = new AbortController();
    const deadline = new AbortController();
    t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
      assert.equal(milliseconds, 90_000);
      return deadline.signal;
    });
    let signalStarted: (signal: AbortSignal) => void = () => undefined;
    const started = new Promise<AbortSignal>((resolve) => {
      signalStarted = resolve;
    });
    const model = new MockLanguageModelV3({
      doGenerate: ({ abortSignal }) => {
        assert.ok(abortSignal);
        signalStarted(abortSignal);
        return new Promise((_, reject) => {
          abortSignal.addEventListener(
            "abort",
            () => reject(new DOMException("Cancelled", "AbortError")),
            { once: true },
          );
        });
      },
    });
    const pending = createTranslateBatch(model, shutdown.signal)(
      ["Hello"],
      "zh",
    );
    const rejected = assert.rejects(pending, { name: "AbortError" });
    const providerSignal = await started;
    (cause === "shutdown" ? shutdown : deadline).abort();
    await rejected;
    assert.equal(providerSignal.aborted, true);
    assert.equal(model.doGenerateCalls.length, 1);
  });
}

void test("full readers translate both sides, examples and legacy lens points while preserving citations", async () => {
  const detail = {
    title: "Bill",
    description: "Summary",
    articleContent: "Explanation",
    originalContent: "Source",
    lensData: {
      left: {
        stance: "Supporters favor access",
        points: [
          {
            text: "It opens data",
            example: { fact: "Researchers wait", relevance: "Access matters" },
            sourceIds: [1],
          },
        ],
      },
      right: {
        stance: "Opponents cite costs",
        points: [
          "It costs money",
          {
            text: "Privacy matters",
            example: "A prior disclosure",
            sourceIds: [1],
          },
        ],
      },
      sources: [
        {
          id: 1,
          title: "Original headline",
          url: "https://example.com/source",
        },
      ],
    },
  };
  const source = readerTranslationSource(detail);
  const segments = sourceSegments(source);
  assert.ok(
    segments.some((x) => x.key === "lensData.left.points.0.example.relevance"),
  );
  const translated = applySegments(
    detail.lensData,
    await translateSegments(segments, "zh", upper),
    "lensData",
  );
  assert.equal(translated.left.stance, "SUPPORTERS FAVOR ACCESS");
  assert.equal(translated.right.points[0], "IT COSTS MONEY");
  assert.deepEqual(translated.sources, detail.lensData.sources);
});

void test("action timeline has a translated display copy and unchanged original record", async () => {
  const detail = {
    title: "Bill",
    description: "Summary",
    articleContent: "Explainer",
    originalContent: "Legal text",
    actions: [{ date: "2026-01-01", text: "Passed committee" }],
  };
  const source = readerTranslationSource(detail);
  const segments = sourceSegments(source);
  assert.ok(segments.some((s) => s.key === "actions.0.text"));
  assert.equal(
    applySegments(
      detail.actions,
      await translateSegments(segments, "zh", upper),
      "actions",
    )[0]?.text,
    "PASSED COMMITTEE",
  );
  assert.equal(detail.actions[0]?.text, "Passed committee");
});
