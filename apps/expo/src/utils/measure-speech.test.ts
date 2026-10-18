import assert from "node:assert/strict";
import test from "node:test";

import type { PublicTrillionGraph } from "@acme/validators";

import { graphSpeechChunks } from "./measure-speech";

void test("measure narration reads translated explanations and attribution without speaking source metadata", () => {
  const graph = {
    measure: { title: "住房提案" },
    summary: { text: "用于住房", quotes: [{ text: "Original legal quote" }] },
    background: { text: "当前规则" },
    nodes: [
      {
        title: "费用是多少？",
        body: "增加债务",
        attribution: { name: "Test Author" },
        quotes: [{ text: "Source quotation" }],
      },
    ],
  } as unknown as PublicTrillionGraph;
  const text = graphSpeechChunks(graph, "zh").join(" ");
  assert.ok(text.includes("住房提案"));
  assert.ok(text.includes("当前规则"));
  assert.ok(text.includes("Test Author"));
  assert.ok(text.includes("增加债务"));
  assert.ok(!text.includes("Original legal quote"));
  assert.ok(!text.includes("Source quotation"));
});
