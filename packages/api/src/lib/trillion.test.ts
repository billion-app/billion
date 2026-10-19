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

/** Narrow a value the fixture guarantees, failing the test if it is missing. */
function must<T>(value: T | undefined): T {
  assert.ok(value !== undefined);
  return value;
}

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

function withHistoricalContext() {
  const value = clone();
  value.nodes.push({
    id: "b-before",
    kind: "branch",
    title: "What was it like before?",
    label: "What was it like before?",
    quotes: [],
  });
  value.edges.push({
    id: "part-before",
    from: "b-before",
    to: value.rootId,
    type: "part",
  });
  const node = must(value.nodes.find((n) => n.id === "p-unspent"));
  node.context = {
    topic: "history",
    period: "2015–16; audit published 2018",
    scope: "California MHSA local balances",
    limitation:
      "This is a historical unspent balance, not proof of current recoverable savings or how the proposed wealth tax would perform.",
    money: [
      {
        nominal: "$231 million",
        currency: "USD",
        scope: {
          period: "End of fiscal year 2015–16",
          jurisdiction: "California",
          timing: "stock",
          accounting: "unspecified",
        },
        comparison: {
          state: "unavailable",
          reason:
            "No matching total fund balance is established by this source.",
        },
      },
    ],
  };
  value.edges.push({
    id: "before-history",
    from: node.id,
    to: "b-before",
    type: "detail",
  });
  return { value, node };
}

void test("context publishes through the same source freshness and snapshot-stripping gate", () => {
  const { value, node } = withHistoricalContext();
  const published = publishedTrillionGraph(corpus.guide, "40", value, current);
  assert.ok(published);
  assert.equal(
    published.nodes.find((n) => n.id === node.id)?.context?.money[0]?.comparison
      .state,
    "unavailable",
  );
  assert.ok(published.sources.every((s) => !("snapshot" in s)));
  const stale = current.filter((s) => !s.url.includes("2017-117"));
  assert.equal(publishedTrillionGraph(corpus.guide, "40", value, stale), null);
});

void test("budget context rejects missing coverage, mismatched periods and uncited denominator amounts", () => {
  const { value, node } = withHistoricalContext();
  const context = must(node.context);
  const money = must(context.money[0]);
  context.money = [];
  assert.equal(trillionGraphSchema.safeParse(value).success, false);
  context.money = [money];
  money.comparison = {
    state: "available",
    numerator: { min: 231e6, max: 231e6 },
    denominator: {
      name: "Relevant balance",
      amount: 1e9,
      currency: "USD",
      scope: { ...money.scope },
      evidence: [
        {
          sourceId: must(node.quotes[0]).sourceId,
          locator: must(node.quotes[0]).locator,
        },
      ],
    },
    basis: "measured",
  };
  money.scope.accounting = "gross";
  money.comparison.denominator.scope.accounting = "gross";
  assert.equal(
    trillionGraphSchema.safeParse(value).success,
    false,
    "a real locator does not verify an invented denominator",
  );
  money.comparison.denominator.amount = 231e6;
  assert.equal(trillionGraphSchema.safeParse(value).success, true);
  money.comparison.denominator.scope.period = "2026–27";
  assert.equal(trillionGraphSchema.safeParse(value).success, false);
});

void test("campaign claims cannot become background facts, and highlights must point to relevant quoted evidence", () => {
  const { value, node } = withHistoricalContext();
  const crux = must(value.nodes.find((n) => n.id === "x-history"));
  crux.highlight = {
    rank: 1,
    reason:
      "Past delivery helps readers evaluate the proposed use of additional funding.",
    evidence: [node.id],
  };
  assert.equal(trillionGraphSchema.safeParse(value).success, true);
  crux.highlight.evidence = ["b-what"];
  assert.equal(trillionGraphSchema.safeParse(value).success, false);
  delete crux.highlight;
  delete node.context;
  assert.equal(
    trillionGraphSchema.safeParse(value).success,
    false,
    "background cannot bypass the context checks by omitting metadata",
  );
  node.context = withHistoricalContext().node.context;
  node.kind = "argument";
  node.attribution = { name: "Campaign" };
  assert.equal(trillionGraphSchema.safeParse(value).success, false);
});

void test("the Prop 40 pilot passes the machine gate and strips snapshots", () => {
  const published = publishedTrillionGraph(corpus.guide, "40", graph, current);
  assert.ok(published);
  assert.equal(published.nodes.length, graph.nodes.length);
  assert.ok(published.sources.every((s) => !("snapshot" in s)));
});

void test("an altered quote, a changed document or a changed guide entry fails closed", () => {
  const altered = clone();
  const provision = must(altered.nodes.find((n) => n.kind === "provision"));
  must(provision.quotes[0]).text = must(provision.quotes[0]).text.replace(
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
  must(guide.measures[0]).title += " (amended)";
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
  delete must(unstanced.edges.find((e) => e.type === "weighs")).stance;
  assert.equal(trillionGraphSchema.safeParse(unstanced).success, false);

  const money = clone();
  must(money.nodes.find((n) => n.kind === "generated")).title =
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
  must(unquoted.nodes.find((n) => n.kind === "argument")).quotes = [];
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
  const precedent = must(graph.sources.find((s) => s.role === "precedent"));
  assert.ok(precedent.title);
  assert.ok(graph.nodes.some((n) => n.kind === "precedent"));

  const offHost = clone();
  must(offHost.sources.find((s) => s.role === "precedent")).url =
    "https://example.com/report.pdf";
  assert.equal(trillionGraphSchema.safeParse(offHost).success, false);

  const notPdf = clone();
  must(notPdf.sources.find((s) => s.role === "precedent")).url =
    "https://lao.ca.gov/ballot/2004/63_11_2004.htm";
  assert.equal(trillionGraphSchema.safeParse(notPdf).success, false);

  // A provision may not quote an old audit, and a precedent may not quote the bill.
  const crossed = clone();
  const provision = must(crossed.nodes.find((n) => n.kind === "provision"));
  must(provision.quotes[0]).sourceId = precedent.id;
  assert.equal(trillionGraphSchema.safeParse(crossed).success, false);
  const borrowed = clone();
  must(
    must(borrowed.nodes.find((n) => n.kind === "precedent")).quotes[0],
  ).sourceId = "law-40";
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
    must(g.nodes.find((n) => n.id === "a-fair")).title = title;
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
  must(must(quoted.nodes.find((n) => n.kind === "argument")).quotes[0]).text +=
    " **x**";
  assert.equal(trillionGraphSchema.safeParse(quoted).success, false);
  assert.deepEqual(trillionEmphasis("a **b** c"), [
    { text: "a ", bold: false },
    { text: "b", bold: true },
    { text: " c", bold: false },
  ]);
});

void test("the summary quotes the measure's own text, verbatim", () => {
  assert.ok(graph.summary);
  assert.ok(
    publishedTrillionGraph(corpus.guide, "40", graph, current)?.summary,
  );

  const fromAnalysis = clone();
  must(fromAnalysis.summary).quotes[0] = {
    ...must(must(fromAnalysis.summary).quotes[0]),
    sourceId: "analysis-40",
  };
  assert.equal(trillionGraphSchema.safeParse(fromAnalysis).success, false);

  const misquoted = clone();
  must(must(misquoted.summary).quotes[0]).text =
    "An excise tax is imposed on every Californian who owns a home.";
  assert.equal(
    publishedTrillionGraph(corpus.guide, "40", misquoted, current),
    null,
  );
});

void test("defined terms explain jargon without stating amounts", () => {
  const withTerms = (terms: TrillionGraph["terms"]) =>
    trillionGraphSchema.safeParse({ ...clone(), terms }).success;
  assert.equal(
    withTerms([
      {
        term: "spending limit",
        plain: "A cap on how much the state can spend each year.",
      },
    ]),
    true,
  );
  assert.equal(
    withTerms([
      { term: "net worth", plain: "Everything you own, over $1 billion here." },
    ]),
    false,
  );
  const twice = {
    term: "special tax",
    plain: "Tax money set aside for a named purpose.",
  };
  assert.equal(withTerms([twice, { ...twice, term: "Special Tax" }]), false);
});

void test("a graph may not run deeper than the depth limit", () => {
  const deep = clone();
  let parent = "a-fair";
  for (let i = 0; i < 6; i++) {
    const id = `deep-${i}`;
    deep.nodes.push({
      id,
      kind: "question",
      label: `Deeper ${i}`,
      title: `Is step ${i} true?`,
      quotes: [],
    });
    deep.edges.push({ id: `deep-e${i}`, from: id, to: parent, type: "asks" });
    parent = id;
  }
  const result = trillionGraphSchema.safeParse(deep);
  if (result.success) assert.fail("a graph deeper than the limit parsed");
  assert.ok(
    result.error.issues.some((i) =>
      i.message.includes("steps from the main case"),
    ),
  );
});

void test("Billion's own claims must rest on a quoted source", () => {
  const unsourced = clone();
  unsourced.nodes.push({
    id: "g-bare",
    kind: "generated",
    label: "Bare assertion",
    title: "This would **change everything**.",
    quotes: [],
  });
  unsourced.edges.push({
    id: "e-bare",
    from: "g-bare",
    to: "x-fair",
    type: "weighs",
    stance: "for",
  });
  const result = trillionGraphSchema.safeParse(unsourced);
  if (result.success) assert.fail("an unsourced claim parsed");
  assert.ok(
    result.error.issues.some((i) =>
      i.message.includes("rest on a quoted source"),
    ),
  );

  const sourced = structuredClone(unsourced);
  sourced.edges.push({
    id: "e-src",
    from: "t-tax",
    to: "g-bare",
    type: "supports",
  });
  assert.equal(trillionGraphSchema.safeParse(sourced).success, true);
});
