import assert from "node:assert/strict";
import test from "node:test";

import { publicTrillionGraphSchema } from "@acme/validators";

import pilot from "./development/prop40-pilot.json";
import { TrillionModel } from "./model";

const graph = publicTrillionGraphSchema.parse(pilot);
const model = new TrillionModel(graph);

void test("the main case opens on its basics and never on a pro/con split", () => {
  const cats = model.categories(graph.rootId);
  assert.deepEqual(
    cats.map((c) => c.key),
    ["basics", "disagree", "open"],
  );
  assert.equal(model.defaultTab(graph.rootId), "basics");
  assert.equal(cats[0]?.items.length, 4);
  assert.ok(
    (cats[1]?.items ?? []).every(
      ({ edge }) => model.node(edge.from).kind === "crux",
    ),
  );
});

void test("a disputed question groups every side together with its lean", () => {
  const crux = model.categories(graph.rootId)[1]?.items[0]?.edge.from ?? "";
  const args = model.categories(crux).find((c) => c.key === "args");
  assert.ok(args);
  assert.ok(args.items.length > 1);
  assert.ok(
    args.items.every(({ edge }) => edge.type === "weighs" && edge.stance),
  );
  assert.match(model.cruxState(crux).text, /^(Disputed|Mostly|Depends)/);
});

void test("the map lights the main case, the focus and only the open tab", () => {
  const root = model.lit([{ t: "node", id: graph.rootId }], "basics");
  assert.equal(root.nodes.length - root.hints.length, 5);
  const deep = model.lit(
    [
      { t: "node", id: graph.rootId },
      { t: "node", id: "a-expand" },
    ],
    model.defaultTab("a-expand"),
  );
  assert.ok(deep.nodes.includes(graph.rootId));
  assert.ok(deep.nodes.includes("a-expand"));
  assert.ok(deep.nodes.length - deep.hints.length < graph.nodes.length / 4);
});

void test("each card in the open tab hints at one grayed grandchild", () => {
  const view = model.lit([{ t: "node", id: graph.rootId }], "disagree");
  assert.ok(view.hints.length > 0);
  for (const hint of view.hints) {
    assert.ok(view.nodes.includes(hint));
    assert.ok(
      graph.edges.some(
        (e) => (e.from === hint || e.to === hint) && view.edges.includes(e.id),
      ),
    );
  }
  assert.equal(new Set(view.hints).size, view.hints.length);
});
