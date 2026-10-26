import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { trillionGraphSchema } from "@acme/validators";

import { auditTrillionClarity } from "./trillion-clarity.js";

const pilot = () =>
  trillionGraphSchema.parse(
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

void test("an unexplained comparison is surfaced even with a verified quote", () => {
  const graph = pilot();
  const node = graph.nodes.find((item) => item.kind === "provision");
  assert.ok(node);
  node.title = "Creates **narrower review** for eligible projects";
  node.body = undefined;
  assert.ok(node.quotes.length);
  const report = auditTrillionClarity(graph);
  assert.ok(
    report.comparisonsWithoutContext.some((item) => item.id === node.id),
  );
  assert.ok(report.coverageToReview.cards.some((item) => item.id === node.id));
  node.body =
    "Agencies could no longer require additional project alternatives.";
  assert.ok(
    !auditTrillionClarity(graph).comparisonsWithoutContext.some(
      (item) => item.id === node.id,
    ),
  );
});

void test("a campaign quotation alone does not provide a linked legal mechanism", () => {
  const graph = pilot();
  const argument = graph.nodes.find((item) => item.kind === "argument");
  const provision = graph.nodes.find((item) => item.kind === "provision");
  assert.ok(argument && provision);
  graph.edges = graph.edges.filter((edge) => edge.to !== argument.id);
  assert.ok(
    auditTrillionClarity(graph).argumentsWithoutMechanism.some(
      (item) => item.id === argument.id,
    ),
  );
  graph.edges.push({
    id: "mechanism-check",
    from: provision.id,
    to: argument.id,
    type: "qualifies",
    why: "The spending requirement does not establish that services will improve.",
  });
  assert.ok(
    !auditTrillionClarity(graph).argumentsWithoutMechanism.some(
      (item) => item.id === argument.id,
    ),
  );
  graph.edges[graph.edges.length - 1]!.why = undefined;
  assert.ok(
    auditTrillionClarity(graph).argumentsWithoutMechanism.some(
      (item) => item.id === argument.id,
    ),
  );
});
