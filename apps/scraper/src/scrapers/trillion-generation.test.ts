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
const options = {
  model: "test-model",
  maxModelCalls: 1,
  maxPromptChars: 400000,
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
