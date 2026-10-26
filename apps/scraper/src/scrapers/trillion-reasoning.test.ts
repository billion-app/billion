import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { trillionGraphSchema } from "@acme/validators";

import { assessTrillionReasoning } from "./trillion-reasoning.js";

function exchange() {
  const graph = trillionGraphSchema.parse(
    JSON.parse(
      readFileSync(
        new URL(
          "../../../../docs/evidence/455/prop40-graph.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
  const anchor = graph.edges.find(
    (edge) =>
      edge.type === "weighs" &&
      graph.nodes.some(
        (node) => node.id === edge.from && node.kind === "argument",
      ),
  );
  assert.ok(anchor);
  const claim = graph.nodes.find((node) => node.id === anchor.from);
  assert.ok(claim);
  graph.nodes.push(
    { ...claim, id: "test-objection", label: "Specific objection" },
    { ...claim, id: "test-reply", label: "Qualified reply" },
  );
  graph.edges.push(
    {
      id: "test-challenge",
      from: "test-objection",
      to: claim.id,
      type: "challenges",
    },
    {
      id: "test-response",
      from: "test-reply",
      to: "test-objection",
      type: "qualifies",
    },
  );
  return { graph, anchor };
}

void test("finds nested exchanges without requiring every reply to weigh on the dispute", () => {
  const { graph, anchor } = exchange();
  const dispute = assessTrillionReasoning(graph).disputes.find(
    (item) => item.id === anchor.to,
  );
  assert.ok(
    dispute?.exchanges.some(
      (path) =>
        path.claim === anchor.from &&
        path.objection === "test-objection" &&
        path.reply === "test-reply",
    ),
  );
});

void test("two-way links and unanswered questions do not masquerade as replies", () => {
  const { graph, anchor } = exchange();
  const reply = graph.nodes.find((node) => node.id === "test-reply");
  assert.ok(reply);
  reply.kind = "question";
  graph.edges.push({
    id: "test-cycle",
    from: anchor.from,
    to: "test-objection",
    type: "challenges",
  });
  const dispute = assessTrillionReasoning(graph).disputes.find(
    (item) => item.id === anchor.to,
  );
  assert.ok(
    !dispute?.exchanges.some((path) => path.objection === "test-objection"),
  );
});

void test("duplicate links do not inflate exchange counts", () => {
  const { graph, anchor } = exchange();
  const before = assessTrillionReasoning(graph);
  const response = graph.edges.find((edge) => edge.id === "test-response");
  assert.ok(response);
  graph.edges.push(
    { ...response, id: "test-duplicate" },
    { ...anchor, id: "test-duplicate-main" },
  );
  assert.deepEqual(assessTrillionReasoning(graph), before);
});
