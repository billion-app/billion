import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { TrillionGraph } from "@acme/validators";
import {
  quoteAppearsIn,
  readingOrderText,
  trillionEmphasis,
  trillionGraphSchema,
} from "@acme/validators";

import type { OfficialGuidePayload } from "./official-guide-cache";
import { publishedTrillionGraph, trillionSourceUrls } from "./trillion";

const evidence = (name: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../docs/evidence/455/${name}`, import.meta.url),
      "utf8",
    ),
  ) as unknown;
const graph = evidence("prop40-graph.json") as TrillionGraph;
const corpus = evidence("prop40-corpus.json") as {
  guide: OfficialGuidePayload;
  sources: TrillionGraph["sources"];
};
const current = corpus.sources.map((s) => ({
  url: s.url,
  hash: s.documentHash,
}));
const clone = (): TrillionGraph => structuredClone(graph);

void test("the Prop 40 pilot passes the machine gate and strips snapshots", () => {
  const published = publishedTrillionGraph(corpus.guide, "40", graph, current);
  assert.ok(published);
  assert.equal(published.nodes.length, graph.nodes.length);
  assert.ok(published.sources.every((s) => !("snapshot" in s)));
});

void test("an altered quote, a changed document or a changed guide entry fails closed", () => {
  const altered = clone();
  const provision = altered.nodes.find((n) => n.kind === "provision")!;
  provision.quotes[0]!.text = provision.quotes[0]!.text.replace(
    "5 percent",
    "2 percent",
  );
  assert.equal(
    publishedTrillionGraph(corpus.guide, "40", altered, current),
    null,
  );

  const stale = current.map((s, i) =>
    i === 0 ? { ...s, hash: "0".repeat(64) } : s,
  );
  assert.equal(publishedTrillionGraph(corpus.guide, "40", graph, stale), null);

  const guide = structuredClone(corpus.guide);
  guide.measures[0]!.title += " (amended)";
  assert.equal(publishedTrillionGraph(guide, "40", graph, current), null);
  assert.equal(
    publishedTrillionGraph(corpus.guide, "41", graph, current),
    null,
  );
  assert.equal(publishedTrillionGraph(corpus.guide, "40", null, current), null);
});

void test("structure rules keep the graph shaped like the design", () => {
  const noCrux = clone();
  noCrux.nodes = noCrux.nodes.filter((n) => n.kind !== "crux");
  assert.equal(trillionGraphSchema.safeParse(noCrux).success, false);

  const unstanced = clone();
  delete unstanced.edges.find((e) => e.type === "weighs")!.stance;
  assert.equal(trillionGraphSchema.safeParse(unstanced).success, false);

  const money = clone();
  money.nodes.find((n) => n.kind === "generated")!.title =
    "It raises about $5 billion.";
  assert.equal(trillionGraphSchema.safeParse(money).success, false);

  const wrongRevision = clone();
  wrongRevision.verification = {
    state: "verified",
    by: "editor",
    at: "2026-10-12T00:00:00.000Z",
    revision: "some-other-revision",
  };
  assert.equal(trillionGraphSchema.safeParse(wrongRevision).success, false);
  assert.equal(
    trillionGraphSchema.parse(graph).verification.state,
    "unverified",
  );

  const unquoted = clone();
  unquoted.nodes.find((n) => n.kind === "argument")!.quotes = [];
  assert.equal(trillionGraphSchema.safeParse(unquoted).success, false);
});

void test("quotes match across two-column layout but not out of order", () => {
  const left = [
    "Section 9. The Legislature may amend the",
    "act by a two-thirds vote of each house",
    "of the membership, as provided by statute.",
    "Filler text in the left column, line four",
    "Filler text in the left column, line five",
    "Filler text in the left column, line six",
  ];
  const page = left
    .map((line, i) => `${line.padEnd(50)}right column line ${i} continues`)
    .join("\n");
  assert.match(readingOrderText(page), /amend the\s+act by/);
  assert.ok(quoteAppearsIn(page, "may amend the act by a two-thirds vote"));
  assert.ok(quoteAppearsIn(page, "may amend … of the membership, as provided"));
  assert.equal(
    quoteAppearsIn(page, "of the membership … may amend the act"),
    false,
  );
});

void test("freshness URLs come from stored graphs", () => {
  assert.deepEqual(
    trillionSourceUrls([graph, { not: "a graph" }]).sort(),
    corpus.sources.map((s) => s.url).sort(),
  );
});

void test("precedent is quoted from archived official PDFs and never stands in for the measure", () => {
  const precedent = graph.sources.find((s) => s.role === "precedent")!;
  assert.ok(precedent.title);
  assert.ok(graph.nodes.some((n) => n.kind === "precedent"));

  const offHost = clone();
  offHost.sources.find((s) => s.role === "precedent")!.url =
    "https://example.com/report.pdf";
  assert.equal(trillionGraphSchema.safeParse(offHost).success, false);

  const notPdf = clone();
  notPdf.sources.find((s) => s.role === "precedent")!.url =
    "https://lao.ca.gov/ballot/2004/63_11_2004.htm";
  assert.equal(trillionGraphSchema.safeParse(notPdf).success, false);

  // A provision may not quote an old audit, and a precedent may not quote the bill.
  const crossed = clone();
  const provision = crossed.nodes.find((n) => n.kind === "provision")!;
  provision.quotes[0]!.sourceId = precedent.id;
  assert.equal(trillionGraphSchema.safeParse(crossed).success, false);
  const borrowed = clone();
  borrowed.nodes.find((n) => n.kind === "precedent")!.quotes[0]!.sourceId =
    "law-40";
  assert.equal(trillionGraphSchema.safeParse(borrowed).success, false);

  // Precedent freshness is enforced like any other source.
  const stale = current.map((s) =>
    s.url === precedent.url ? { ...s, hash: "0".repeat(64) } : s,
  );
  assert.equal(publishedTrillionGraph(corpus.guide, "40", graph, stale), null);
  assert.ok(trillionSourceUrls([graph]).includes(precedent.url));
});

void test("emphasis bolds key phrases only, as bill briefs do", () => {
  const withTitle = (title: string) => {
    const g = clone();
    g.nodes.find((n) => n.id === "a-fair")!.title = title;
    return trillionGraphSchema.safeParse(g).success;
  };
  assert.equal(
    withTitle("Billionaires pay **lower tax rates** than working families."),
    true,
  );
  assert.equal(
    withTitle("**Billionaires pay lower tax rates than working families.**"),
    false,
  );
  assert.equal(
    withTitle("Billionaires pay **lower tax rates than working families."),
    false,
  );
  assert.equal(
    withTitle("**Billionaires** pay **lower** tax **rates** than families."),
    false,
  );
  const quoted = clone();
  quoted.nodes.find((n) => n.kind === "argument")!.quotes[0]!.text += " **x**";
  assert.equal(trillionGraphSchema.safeParse(quoted).success, false);
  assert.deepEqual(trillionEmphasis("a **b** c"), [
    { text: "a ", bold: false },
    { text: "b", bold: true },
    { text: " c", bold: false },
  ]);
});
