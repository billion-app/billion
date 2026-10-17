import assert from "node:assert/strict";
import test from "node:test";

import { applySegments } from "./content-translation";
import { measureSegments, measureTranslationId } from "./measure-translation";

void test("measure translations cover reader prose but preserve evidence and identity", () => {
  const measure = {
    title: "Housing bonds",
    displayTitle: "**Housing** bonds",
    sourceUrl: "https://example.com",
    voteMeaningYes: "Allows bonds",
    proArguments: [{ text: "Vote yes", sourceName: "Author" }],
  };
  const graph = {
    revision: "rev1",
    measure: { number: "1", title: measure.title },
    summary: {
      text: "Funds housing",
      quotes: [{ text: "Exact law", sourceId: "law" }],
    },
    nodes: [
      {
        id: "n1",
        label: "Costs",
        title: "What will it cost?",
        body: "More debt",
        attribution: { name: "Author" },
        quotes: [{ text: "Exact quote" }],
      },
    ],
    sources: [{ url: "https://example.com", text: "Original law" }],
  };
  const segments = measureSegments(measure, graph, "reader");
  assert.ok(segments.some((s) => s.key === "graph.nodes.0.body"));
  assert.ok(segments.some((s) => s.key === "measure.voteMeaningYes"));
  assert.ok(
    !segments.some((s) =>
      /quotes|sources|attribution|proArguments|revision/.test(s.key),
    ),
  );
  const translations = Object.fromEntries(
    segments.map((s) => [s.key, `中文 ${s.text}`]),
  );
  const translated = applySegments(graph, translations, "graph");
  assert.equal(translated.nodes[0]?.title, "中文 What will it cost?");
  assert.deepEqual(translated.sources, graph.sources);
  assert.deepEqual(translated.nodes[0].quotes, graph.nodes[0]?.quotes);
  assert.equal(translated.revision, graph.revision);
  assert.equal(graph.nodes[0]?.title, "What will it cost?");
  assert.deepEqual(
    measureSegments(measure, graph, "title").map((s) => s.key),
    ["measure.title", "measure.displayTitle"],
  );
  assert.notEqual(
    measureTranslationId("2026-11-03", "1", "title"),
    measureTranslationId("2026-11-03", "1", "reader"),
  );
  assert.notEqual(
    measureTranslationId("2026-11-03", "1", "reader"),
    measureTranslationId("2028-11-07", "1", "reader"),
  );
});
