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
        highlight: {
          rank: 1,
          reason: "Past outcomes matter",
          evidence: ["n2"],
        },
        context: {
          topic: "history",
          period: "2015–16",
          scope: "California funds",
          limitation: "Not current savings",
          money: [
            {
              nominal: "$231 million",
              comparison: { state: "unavailable", reason: "No matching total" },
            },
          ],
        },
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
  assert.equal(
    translated.nodes[0].highlight.reason,
    "中文 Past outcomes matter",
  );
  assert.equal(
    translated.nodes[0].context.limitation,
    "中文 Not current savings",
  );
  assert.deepEqual(translated.nodes[0].highlight.evidence, ["n2"]);
  assert.equal(translated.nodes[0].context.money[0]?.nominal, "$231 million");
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

void test("related measures and money translate display prose without changing canonical amounts or evidence", async () => {
  const { withMoneyDisplay } = await import("./measure-translation");
  const { contextMoneySchema, contextMoneyPresentation } =
    await import("@acme/validators");
  const money = contextMoneySchema.parse({
    nominal: "$20 million",
    currency: "USD",
    scope: {
      period: "One year",
      jurisdiction: "California",
      timing: "annual",
      accounting: "gross",
    },
    comparison: { state: "unavailable", reason: "No matching denominator" },
  });
  const source = {
    relationships: [
      {
        takeaway: {
          text: "Both measures could pass",
          sourceIds: ["law"],
          money: [money],
        },
        scenarios: { both: { text: "One rule controls", sourceIds: ["law"] } },
        compact: {
          conflictScopes: {
            condition: { text: "If they conflict", sourceIds: ["law"] },
          },
        },
        sources: [{ url: "https://example.com", snapshot: "Exact law" }],
      },
    ],
    contextualExplanation: {
      review: { findings: "Sources verified" },
      magnitude: [{ period: "Over several years" }],
    },
  };
  const prepared = withMoneyDisplay(source);
  const segments = measureSegments(prepared, null, "reader");
  for (const key of [
    "measure.relationships.0.takeaway.text",
    "measure.relationships.0.scenarios.both.text",
    "measure.relationships.0.compact.conflictScopes.condition.text",
    "measure.relationships.0.takeaway.money.0.display.nominal",
    "measure.contextualExplanation.review.findings",
    "measure.contextualExplanation.magnitude.0.period",
  ])
    assert.ok(
      segments.some((s) => s.key === key),
      key,
    );
  const translated = applySegments(
    prepared,
    Object.fromEntries(segments.map((s) => [s.key, `中文 ${s.text}`])),
    "measure",
  );
  const result = contextMoneySchema.parse(
    translated.relationships[0]?.takeaway.money[0],
  );
  assert.equal(result.nominal, money.nominal);
  assert.deepEqual(result.scope, money.scope);
  assert.deepEqual(result.comparison, money.comparison);
  assert.ok(contextMoneyPresentation(result, "zh").nominal.startsWith("中文"));
  assert.ok(contextMoneyPresentation(result, "zh").scope.startsWith("中文"));
  assert.deepEqual(
    translated.relationships[0]?.sources,
    source.relationships[0]?.sources,
  );
  assert.deepEqual(translated.relationships[0]?.takeaway.sourceIds, ["law"]);
  assert.equal("display" in money, false);
  const graph = withMoneyDisplay({ nodes: [{ context: { money: [money] } }] });
  const graphSegments = measureSegments({}, graph, "reader");
  assert.ok(
    graphSegments.some(
      (s) => s.key === "graph.nodes.0.context.money.0.display.reason",
    ),
  );
  assert.ok(!graphSegments.some((s) => s.key.includes(".comparison.")));
  const translatedGraph = applySegments(
    graph,
    Object.fromEntries(graphSegments.map((s) => [s.key, `中文 ${s.text}`])),
    "graph",
  );
  assert.deepEqual(
    translatedGraph.nodes[0]?.context.money[0]?.comparison,
    money.comparison,
  );
  assert.deepEqual(
    translatedGraph.nodes[0].context.money[0].scope,
    money.scope,
  );
});
