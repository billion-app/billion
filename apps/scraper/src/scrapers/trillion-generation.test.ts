import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { TrillionGraph } from "@acme/validators";

import { generateTrillionGraph } from "./trillion-generation.js";

const evidence = (name: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../docs/evidence/455/${name}`, import.meta.url),
      "utf8",
    ),
  ) as unknown;
const corpus = evidence("prop40-corpus.json");
const pilot = evidence("prop40-graph.json") as TrillionGraph;
const authored = () =>
  structuredClone({ nodes: pilot.nodes, edges: pilot.edges });
const summary = () => {
  const { text, more, quotes } = structuredClone(pilot.summary)!;
  return { text, more, quotes };
};
const options = {
  model: "test-model",
  maxModelCalls: 2,
  maxPromptChars: 400000,
  assessSummary: () => Promise.resolve(summary()),
};

void test("a fabricated quote is dropped along with the node that relied on it", async () => {
  const output = authored();
  const argument = output.nodes.find((n) => n.id === "a-brin")!;
  argument.quotes[0]!.text =
    "Billionaires have promised to leave the state forever.";
  let prompts = 0;
  const result = await generateTrillionGraph(corpus, {
    ...options,
    assess: () => {
      prompts++;
      return Promise.resolve(output);
    },
  });
  assert.equal(prompts, 1);
  assert.ok(result.dropped.includes("a-brin"));
  assert.ok(!result.graph.nodes.some((n) => n.id === "a-brin"));
  assert.ok(
    !result.graph.edges.some((e) => e.from === "a-brin" || e.to === "a-brin"),
  );
  assert.equal(result.graph.verification.state, "unverified");
  assert.equal(result.graph.generation.model, "test-model");
});

void test("unchanged input reuses the previous graph without a model call", async () => {
  const first = await generateTrillionGraph(corpus, {
    ...options,
    assess: () => Promise.resolve(authored()),
  });
  const again = await generateTrillionGraph(corpus, {
    ...options,
    maxModelCalls: 0,
    previous: first.graph,
    assess: () => Promise.reject(new Error("should not be called")),
  });
  assert.equal(again.reused, true);
  assert.equal(again.graph.revision, first.graph.revision);
});

void test("budgets fail before any model call", async () => {
  const assess = () => Promise.reject(new Error("should not be called"));
  await assert.rejects(
    generateTrillionGraph(corpus, { ...options, maxModelCalls: 0, assess }),
    /maxModelCalls is 0/,
  );
  await assert.rejects(
    generateTrillionGraph(corpus, { ...options, maxPromptChars: 1000, assess }),
    /prompt budget/,
  );
});

void test("curated precedent is captured as PDFs and seeds a precedent question", async () => {
  const { trillionPrecedents } = await import("./trillion-precedents.js");
  const { capturePrecedentSource, trillionCorpusSchema } =
    await import("./trillion-capture.js");
  const { buildTrillionPrompt } = await import("./trillion-generation.js");
  const entries = trillionPrecedents("2026-11-03", "40");
  assert.ok(entries.length > 0);
  assert.deepEqual(trillionPrecedents("2026-11-03", "41"), []);
  await assert.rejects(
    capturePrecedentSource("40", entries[0]!, () =>
      Promise.resolve(Buffer.from("<html>not a pdf</html>")),
    ),
    /not a PDF/,
  );
  const parsed = trillionCorpusSchema.parse(corpus);
  const prompt = buildTrillionPrompt(parsed);
  assert.match(prompt, /Has this been tried before, and did it work\?/);
  const withoutPrecedent = buildTrillionPrompt({
    ...parsed,
    sources: parsed.sources.filter((s) => s.role !== "precedent"),
  });
  assert.doesNotMatch(withoutPrecedent, /tried before/);
});

void test("the evaluator flags thin, one-sided disputes and titles that describe the source", async () => {
  const { assessTrillionGraph } = await import("./trillion-generation.js");
  const { trillionGraphSchema } = await import("@acme/validators");
  const graph = trillionGraphSchema.parse(structuredClone(pilot));
  const report = assessTrillionGraph(graph);
  assert.equal(report.thinCruxes, 0);
  assert.equal(report.nodes, graph.nodes.length);
  const argument = graph.nodes.find((n) => n.id === "a-fair");
  assert.ok(argument);
  argument.title = "Supporters argue billionaires pay **lower rates**.";
  assert.ok(
    assessTrillionGraph(graph).metaTitles.includes(
      "Supporters argue billionaires pay lower rates.",
    ),
  );
});

void test("a summary that misquotes the measure is dropped, not published", async () => {
  const output = authored();
  const misquoted = summary();
  misquoted.quotes = [
    {
      sourceId: "law-40",
      locator: "made up",
      text: "The tax applies to everyone who owns a home in California.",
    },
  ];
  const result = await generateTrillionGraph(corpus, {
    ...options,
    assess: () => Promise.resolve(output),
    assessSummary: () => Promise.resolve(misquoted),
  });
  assert.equal(result.graph.summary, undefined);
  assert.ok(result.dropped.includes("summary"));
});

void test("the summary is drafted from the measure's legal text alone", async () => {
  const { buildTrillionSummaryPrompt } =
    await import("./trillion-generation.js");
  const { trillionCorpusSchema } = await import("./trillion-capture.js");
  const prompt = buildTrillionSummaryPrompt(trillionCorpusSchema.parse(corpus));
  assert.match(prompt, /sourceId "law-40"/);
  // Neither campaign's arguments nor the Analyst reach the summary call.
  assert.doesNotMatch(
    prompt,
    /arguments-40|analysis-40|SEIU|Legislative Analyst/,
  );
  assert.match(prompt, /not "one-time"|"one-time"/);
});

void test("one bad summary quote never discards the cards' good quotes", async () => {
  const misquoted = summary();
  misquoted.quotes = [
    misquoted.quotes[0]!,
    {
      sourceId: "law-40",
      locator: "made up",
      text: "The tax applies to everyone who owns a home in California.",
    },
  ];
  const result = await generateTrillionGraph(corpus, {
    ...options,
    assess: () => Promise.resolve(authored()),
    assessSummary: () => Promise.resolve(misquoted),
  });
  assert.equal(result.graph.nodes.length, pilot.nodes.length);
  assert.equal(result.graph.summary?.quotes.length, 1);
});

void test("seed cards deeper than the seed depth are pruned, not published", async () => {
  const output = authored();
  let parent = "a-fair";
  for (let i = 0; i < 4; i++) {
    const id = `deep-${i}`;
    output.nodes.push({
      id,
      kind: "question",
      label: `Deeper ${i}`,
      title: `Is step ${i} true?`,
      quotes: [],
    });
    output.edges.push({ id: `deep-e${i}`, from: id, to: parent, type: "asks" });
    parent = id;
  }
  const result = await generateTrillionGraph(corpus, {
    ...options,
    assess: () => Promise.resolve(output),
  });
  assert.ok(result.dropped.some((d) => d.endsWith("(too deep)")));
  assert.ok(!result.graph.nodes.some((n) => n.id === "deep-3"));
});

void test("a record card missing its measure is repaired from the source it quotes", async () => {
  const { repairRecordKinds } = await import("./trillion-generation.js");
  const sources = [
    { id: "law-40", number: "40", role: "legal-text" },
    { id: "law-41", number: "41", role: "legal-text" },
    { id: "analysis-40", number: "40", role: "official-analysis" },
  ];
  const card = (id: string, sourceId: string) => ({
    id,
    kind: "record" as const,
    label: id,
    title: id,
    quotes: [{ sourceId, locator: "§1", text: "quoted text here" }],
  });
  const { nodes, retyped } = repairRecordKinds(
    [
      card("other", "law-41"),
      card("own", "law-40"),
      card("lao", "analysis-40"),
    ],
    sources,
    "40",
  );
  assert.deepEqual(nodes[0]?.record, { number: "41" });
  assert.equal(nodes[1]?.kind, "provision");
  assert.equal(nodes[2]?.kind, "analysis");
  assert.equal(retyped.length, 3);
});

void test("a record for a measure not on this ballot becomes the card its quote supports", async () => {
  const { repairRecordKinds } = await import("./trillion-generation.js");
  const { nodes } = repairRecordKinds(
    [
      {
        id: "record-13",
        kind: "record",
        label: "Prop 13",
        title: "Prop 13 limits property taxes",
        record: { number: "13" },
        quotes: [
          { sourceId: "law-43", locator: "§1", text: "quoted text here" },
        ],
      },
      {
        id: "record-44",
        kind: "record",
        label: "Prop 44",
        title: "Prop 44 conflicts",
        record: { number: "44" },
        quotes: [
          { sourceId: "law-44", locator: "§1", text: "quoted text here" },
        ],
      },
    ],
    [
      { id: "law-43", number: "43", role: "legal-text" },
      { id: "law-44", number: "44", role: "legal-text" },
    ],
    "43",
    ["43", "44"],
  );
  assert.equal(nodes[0]?.kind, "provision");
  assert.equal(nodes[0]?.record, undefined);
  assert.equal(nodes[1]?.kind, "record");
});

void test("an off-ballot record quoting an unattributed argument is dropped", async () => {
  const { repairRecordKinds } = await import("./trillion-generation.js");
  const { nodes, retyped } = repairRecordKinds(
    [
      {
        id: "record-13",
        kind: "record",
        label: "Prop 13",
        title: "Supporters connect Prop 43 to Prop 13",
        record: { number: "13" },
        quotes: [
          { sourceId: "arguments-43", locator: "§1", text: "quoted text" },
        ],
      },
    ],
    [{ id: "arguments-43", number: "43", role: "official-arguments" }],
    "43",
    ["43"],
  );
  assert.equal(nodes.length, 0);
  assert.match(retyped[0] ?? "", /record-13 \(dropped/);
});

void test("a malformed card costs only itself", async () => {
  const output = authored() as { nodes: unknown[]; edges: unknown[] };
  const index = output.nodes.findIndex(
    (n) => (n as { id: string }).id === "a-brin",
  );
  output.nodes[index] = { id: "a-brin", kind: "nonsense" };
  const result = await generateTrillionGraph(corpus, {
    ...options,
    assess: () => Promise.resolve(output),
  });
  assert.ok(result.dropped.includes("a-brin (malformed)"));
  assert.ok(!result.graph.nodes.some((n) => n.id === "a-brin"));
  assert.ok(result.graph.nodes.length > 10);
});

void test("a card failing a structure check is dropped, not the graph", async () => {
  const output = authored();
  const argument = output.nodes.find((n) => n.id === "a-brin")!;
  delete argument.attribution;
  const result = await generateTrillionGraph(corpus, {
    ...options,
    assess: () => Promise.resolve(output),
  });
  assert.ok(result.dropped.includes("a-brin (failed checks)"));
  assert.ok(!result.graph.nodes.some((n) => n.id === "a-brin"));
});

void test("an ellipsis that omits nothing is closed; a real omission stays", async () => {
  const { closeEmptyElisions } = await import("./trillion-generation.js");
  const source =
    "Appropriations shall not include revenue from the Reserve\nFund. Other text follows here. The audit shall be completed every four years.";
  assert.equal(
    closeEmptyElisions(
      source,
      "shall not include revenue from the Reserve … Fund.",
    ),
    "shall not include revenue from the Reserve Fund.",
  );
  assert.equal(
    closeEmptyElisions(
      source,
      "revenue from the Reserve Fund. … The audit shall be completed",
    ),
    "revenue from the Reserve Fund. … The audit shall be completed",
  );
});
