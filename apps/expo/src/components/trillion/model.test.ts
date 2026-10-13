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
  assert.equal(cats[0]!.items.length, 4);
  assert.ok(
    cats[1]!.items.every(({ edge }) => model.node(edge.from).kind === "crux"),
  );
});

void test("a disputed question groups every side together with its lean", () => {
  const crux = model.categories(graph.rootId)[1]!.items[0]!.edge.from;
  const args = model.categories(crux).find((c) => c.key === "args")!;
  assert.ok(args.items.length > 1);
  assert.ok(
    args.items.every(({ edge }) => edge.type === "weighs" && edge.stance),
  );
  assert.match(model.cruxState(crux).text, /^(Disputed|Mostly|Depends)/);
});

void test("the map lights the main case, the focus and only the open tab", () => {
  const root = model.lit([{ t: "node", id: graph.rootId }], "basics");
  assert.equal(root.nodes.length, 5);
  const deep = model.lit(
    [
      { t: "node", id: graph.rootId },
      { t: "node", id: "a-expand" },
    ],
    model.defaultTab("a-expand"),
  );
  assert.ok(deep.nodes.includes(graph.rootId));
  assert.ok(deep.nodes.includes("a-expand"));
  assert.ok(deep.nodes.length < graph.nodes.length / 4);
});
