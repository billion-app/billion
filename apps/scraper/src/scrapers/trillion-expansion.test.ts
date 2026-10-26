import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { trillionGraphSchema } from "@acme/validators";

import {
  expandTrillionGraph,
  mergeTrillionExpansion,
} from "./trillion-expansion.js";

function fixture() {
  const base = trillionGraphSchema.parse(
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
  const claim = base.nodes.find((node) => node.kind === "argument");
  const evidence = base.nodes.find((node) => node.kind === "provision");
  assert.ok(claim && evidence);
  const additions = {
    nodes: [
      {
        id: "deep-premise",
        kind: "generated",
        label: "A necessary premise",
        title: "An allocation rule does not establish service outcomes",
      },
      {
        id: "deep-reply",
        kind: "generated",
        label: "A limited reply",
        title: "The allocation still constrains which spending is permitted",
      },
      {
        id: "deep-question",
        kind: "question",
        label: "What outcomes would follow?",
        title: "What evidence establishes the resulting service outcomes?",
      },
    ],
    edges: [
      {
        id: "deep-evidence",
        from: evidence.id,
        to: "deep-premise",
        type: "supports",
        why: "The provision states the allocation rule, not a measured service outcome.",
      },
      {
        id: "deep-reply-evidence",
        from: evidence.id,
        to: "deep-reply",
        type: "supports",
        why: "The provision specifies the permitted spending purposes.",
      },
      {
        id: "deep-objection",
        from: "deep-premise",
        to: claim.id,
        type: "qualifies",
        why: "A required spending purpose alone does not establish the predicted result.",
      },
      {
        id: "deep-response",
        from: "deep-reply",
        to: "deep-premise",
        type: "qualifies",
        why: "The remaining spending constraint does not resolve the question about service outcomes.",
      },
      {
        id: "deep-inquiry",
        from: "deep-question",
        to: "deep-premise",
        type: "asks",
        why: "Evidence about the outcome is needed to assess the claim.",
      },
    ],
  };
  return { base, additions, claim, evidence };
}
const options = { model: "test-model" };

void test("expansion preserves every existing card, link and metadata field", () => {
  const { base, additions } = fixture();
  const saved = structuredClone(base);
  const result = mergeTrillionExpansion(base, additions, options);
  assert.deepEqual(base, saved);
  assert.deepEqual(result.graph.nodes.slice(0, base.nodes.length), base.nodes);
  assert.deepEqual(result.graph.edges.slice(0, base.edges.length), base.edges);
  const {
    revision: oldRevision,
    nodes: oldNodes,
    edges: oldEdges,
    ...oldMetadata
  } = base;
  const { revision, nodes, edges, ...metadata } = result.graph;
  assert.deepEqual(metadata, oldMetadata);
  assert.notEqual(revision, oldRevision);
  assert.equal(nodes.length - oldNodes.length, 3);
  assert.equal(edges.length - oldEdges.length, 5);
  assert.equal(
    mergeTrillionExpansion(base, additions, options).graph.revision,
    revision,
  );
});

void test("existing IDs cannot be replaced and old relationships cannot be rewritten", () => {
  const { base, additions, claim, evidence } = fixture();
  const nodeOverwrite = structuredClone(additions);
  nodeOverwrite.nodes[0]!.id = claim.id;
  assert.throws(
    () => mergeTrillionExpansion(base, nodeOverwrite, options),
    /cannot replace node/,
  );
  const edgeOverwrite = structuredClone(additions);
  edgeOverwrite.edges[0]!.id = base.edges[0]!.id;
  assert.throws(
    () => mergeTrillionExpansion(base, edgeOverwrite, options),
    /cannot replace edge/,
  );
  const oldToOld = structuredClone(additions);
  oldToOld.edges[0]!.to = claim.id;
  assert.equal(oldToOld.edges[0]!.from, evidence.id);
  assert.throws(
    () => mergeTrillionExpansion(base, oldToOld, options),
    /must touch a new card/,
  );
});

void test("new overview links, ungrounded claims and disconnected cards are rejected", () => {
  const { base, additions } = fixture();
  const flat = structuredClone(additions);
  flat.edges[2]!.to = base.rootId;
  assert.throws(
    () => mergeTrillionExpansion(base, flat, options),
    /not the overview/,
  );
  const ungrounded = structuredClone(additions);
  ungrounded.edges = ungrounded.edges.filter(
    (e) => e.id !== "deep-evidence" && e.id !== "deep-response",
  );
  ungrounded.edges.push({
    id: "deep-extra-inquiry",
    from: "deep-question",
    to: "deep-reply",
    type: "asks",
    why: "This asks about the supporting evidence for the reply.",
  });
  assert.throws(
    () => mergeTrillionExpansion(base, ungrounded, options),
    /rest on a quoted source/,
  );
  const orphan = structuredClone(additions);
  orphan.nodes.push({
    id: "deep-orphan",
    kind: "question",
    label: "Disconnected?",
    title: "What would this disconnected question ask?",
  });
  assert.throws(
    () => mergeTrillionExpansion(base, orphan, options),
    /every node must connect/,
  );
});

void test("new cards beyond seed depth fail instead of pruning original content", () => {
  const { base, additions } = fixture();
  additions.nodes.push({
    id: "deep-beyond",
    kind: "question",
    label: "Further question?",
    title: "What further evidence would settle this question?",
  });
  additions.edges.push({
    id: "deep-beyond-edge",
    from: "deep-beyond",
    to: "deep-question",
    type: "asks",
    why: "This asks about the evidence required by the preceding question.",
  });
  assert.throws(
    () => mergeTrillionExpansion(base, additions, options),
    /seeded depth limit/,
  );
});

void test("budgets and source integrity fail before any model call", async () => {
  const { base, additions } = fixture();
  let calls = 0;
  const opts = {
    model: "test-model",
    maxModelCalls: 1,
    maxPromptChars: 400000,
    assess: async () => {
      calls++;
      return additions;
    },
  };
  await assert.rejects(
    expandTrillionGraph(base, { ...opts, maxModelCalls: 0 }),
    /budget of at least one/,
  );
  await assert.rejects(
    expandTrillionGraph(base, { ...opts, maxPromptChars: 1 }),
    /prompt budget/,
  );
  await assert.rejects(
    expandTrillionGraph(base, { ...opts, maxPromptChars: NaN }),
    /positive integer/,
  );
  const verified = trillionGraphSchema.parse({
    ...base,
    verification: {
      state: "verified",
      by: "editor",
      at: "2026-10-26T12:00:00Z",
      revision: base.revision,
    },
  });
  await assert.rejects(expandTrillionGraph(verified, opts), /Verified graphs/);
  assert.throws(
    () => mergeTrillionExpansion(verified, additions, options),
    /Verified graphs/,
  );
  const corrupt = structuredClone(base);
  corrupt.sources[0]!.hash = "0".repeat(64);
  await assert.rejects(expandTrillionGraph(corrupt, opts), /hash/);
  assert.equal(calls, 0);
  const result = await expandTrillionGraph(base, opts);
  assert.equal(calls, 1);
  assert.equal(result.receipt.baseRevision, base.revision);
});

void test("addition payloads cannot smuggle source or metadata replacements", () => {
  const { base, additions } = fixture();
  assert.throws(
    () =>
      mergeTrillionExpansion(
        base,
        { ...additions, summary: { text: "Replacement" } },
        options,
      ),
    /Unrecognized key/,
  );
  assert.throws(
    () =>
      mergeTrillionExpansion(
        base,
        {
          ...additions,
          nodes: additions.nodes.map((node) => ({ ...node, quotes: [] })),
        },
        options,
      ),
    /Unrecognized key/,
  );
});
