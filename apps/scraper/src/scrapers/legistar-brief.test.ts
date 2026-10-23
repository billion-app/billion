import assert from "node:assert/strict";
import test from "node:test";
import { MockLanguageModelV3 } from "ai/test";

import type {
  LocalDecisionBrief,
  LocalDecisionBriefDocument,
} from "@acme/validators/local-decision";
import {
  computeLocalDecisionSourceContext,
  validateLocalDecisionBrief,
} from "@acme/validators/local-decision";

import {
  generateLocalDecisionBrief,
  localBriefSources,
} from "./legistar-brief.js";

const id = "f5d54c00-a6a7-4d05-8459-e0295bb9559b";
const quote = "The proposal allocates funds to public library improvements.";
const document: LocalDecisionBriefDocument = {
  id,
  contentHash: "a".repeat(64),
  extractedPages: ["", quote],
  processingPolicy: "extract_text",
  extractionStatus: "native",
  isPublicComment: false,
  sourceDeletedAt: null,
};
const brief: LocalDecisionBrief = {
  version: 1,
  language: "en",
  generatedAt: "2026-10-23T00:00:00.000Z",
  sourceContext: "context",
  sourceHashes: { [id]: "a".repeat(64) },
  claims: [
    {
      text: "Library funding is proposed.",
      citations: [{ documentId: id, page: 2, quote }],
    },
  ],
};

test("accepts a brief only with current page evidence", () => {
  assert.deepEqual(
    validateLocalDecisionBrief(brief, [document], "context"),
    brief,
  );
  assert.equal(validateLocalDecisionBrief(brief, [], "context"), null);
  assert.equal(validateLocalDecisionBrief(brief, [document], "changed"), null);
  assert.equal(
    validateLocalDecisionBrief({ ...brief, claims: [] }, [document], "context"),
    null,
  );
  for (const patch of [
    { contentHash: "b".repeat(64) },
    { extractedPages: null },
    { extractedPages: [quote, ""] },
    { extractedPages: ["", "A different passage."] },
    { processingPolicy: "link_only" },
    { extractionStatus: "ocr_required" },
    { isPublicComment: true },
    { sourceDeletedAt: new Date() },
  ])
    assert.equal(
      validateLocalDecisionBrief(brief, [{ ...document, ...patch }], "context"),
      null,
    );
});

test("keeps original page numbers and bounds prompt evidence", () => {
  assert.deepEqual(localBriefSources([document]), [
    { documentId: id, pages: [{ page: 2, text: quote }] },
  ]);
  assert.deepEqual(
    localBriefSources([{ ...document, isPublicComment: true }]),
    [],
  );
  const sources = localBriefSources([
    { ...document, extractedPages: ["x".repeat(30_000), quote] },
  ]);
  assert.equal(
    sources
      .flatMap((source) => source.pages)
      .reduce((sum, page) => sum + page.text.length, 0),
    24_000,
  );
});

test("context follows source changes and ignores occurrence ordering", () => {
  const occurrence = {
    id: "1",
    startsAt: "2026-10-23T00:00:00Z",
    cancelled: false,
    location: "City Hall",
    action: null,
    proposedAction: null,
    passed: null,
    tally: "2-1",
  };
  const input = {
    title: "Library funds",
    status: "Pending",
    sourceUpdatedAt: "2026-10-23T00:00:00Z",
    occurrences: [occurrence, { ...occurrence, id: "2" }],
  };
  const context = computeLocalDecisionSourceContext(input);
  assert.equal(
    computeLocalDecisionSourceContext({
      ...input,
      occurrences: [...input.occurrences].reverse(),
    }),
    context,
  );
  for (const patch of [{ cancelled: true }, { location: "Library" }]) {
    const changedContext = computeLocalDecisionSourceContext({
      ...input,
      occurrences: input.occurrences.map((item) => ({ ...item, ...patch })),
    });
    assert.equal(
      validateLocalDecisionBrief(
        { ...brief, sourceContext: context },
        [document],
        changedContext,
      ),
      null,
      "Changed meeting logistics invalidate an otherwise verified brief",
    );
  }
  assert.notEqual(
    computeLocalDecisionSourceContext({ ...input, status: "Approved" }),
    context,
  );
  assert.notEqual(
    computeLocalDecisionSourceContext({
      ...input,
      occurrences: [{ ...occurrence, passed: "Passed" }],
    }),
    context,
  );
});

test("rejects malformed or fabricated citation locations", () => {
  for (const citation of [
    { documentId: id, page: 3, quote },
    { documentId: "a701aadc-fb26-4877-8686-7a991ef970ad", page: 2, quote },
    {
      documentId: id,
      page: 2,
      quote: "A fabricated quote about library funding.",
    },
  ]) {
    assert.equal(
      validateLocalDecisionBrief(
        { ...brief, claims: [{ text: "A claim", citations: [citation] }] },
        [document],
        "context",
      ),
      null,
    );
  }
  assert.equal(
    validateLocalDecisionBrief(
      { ...brief, sourceHashes: {} },
      [document],
      "context",
    ),
    null,
  );
  assert.equal(
    validateLocalDecisionBrief(
      { ...brief, claims: [{ text: "A claim", citations: [] }] },
      [document],
      "context",
    ),
    null,
  );
});

function evidenceModel(outputs: unknown[]) {
  let index = 0;
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(outputs[index++]) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
      providerMetadata: { scraper: { modelVersion: "fixture:local-brief" } },
    }),
  });
}

const generationInput = {
  title: "Hidden title with extra context",
  sourceContext: "hidden-context",
  documents: [document],
};

test("publishes only after a separate quote-only evidence approval", async () => {
  const model = evidenceModel([
    { claims: brief.claims },
    { verdicts: [{ index: 0, supported: true }] },
  ]);
  const result = await generateLocalDecisionBrief({
    ...generationInput,
    model,
  });
  assert.deepEqual(result?.brief.claims, brief.claims);
  assert.equal(model.doGenerateCalls.length, 2);
  const review = model.doGenerateCalls[1];
  assert.ok(review);
  const userMessage = review.prompt.find((message) => message.role === "user");
  assert.deepEqual(userMessage?.content, [
    {
      type: "text",
      text: JSON.stringify([
        { index: 0, claim: brief.claims[0]?.text, quotes: [quote] },
      ]),
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(review.prompt),
    /hidden-context|Hidden title|documentId/,
  );
});

test("rejects the whole brief for unsupported or incomplete evidence verdicts", async () => {
  const claims = [...brief.claims, ...brief.claims];
  for (const verdicts of [
    [
      { index: 0, supported: true },
      { index: 1, supported: false },
    ],
    [{ index: 0, supported: true }],
    [
      { index: 0, supported: true },
      { index: 0, supported: true },
    ],
    [
      { index: 0, supported: true },
      { index: 2, supported: true },
    ],
  ]) {
    const model = evidenceModel([{ claims }, { verdicts }]);
    assert.equal(
      await generateLocalDecisionBrief({ ...generationInput, model }),
      null,
    );
    assert.equal(model.doGenerateCalls.length, 2);
  }
});

test("does not spend review calls on invalid citations or any calls without sources", async () => {
  const model = evidenceModel([
    {
      claims: [
        {
          text: "Unsupported count",
          citations: [
            {
              documentId: id,
              page: 2,
              quote: "This quote does not appear on the page.",
            },
          ],
        },
      ],
    },
  ]);
  assert.equal(
    await generateLocalDecisionBrief({ ...generationInput, model }),
    null,
  );
  assert.equal(model.doGenerateCalls.length, 1);
  for (const documents of [[], [{ ...document, isPublicComment: true }]]) {
    const unused = evidenceModel([]);
    assert.equal(
      await generateLocalDecisionBrief({
        ...generationInput,
        documents,
        model: unused,
      }),
      null,
    );
    assert.equal(unused.doGenerateCalls.length, 0);
  }
});

test("does not retry a failed evidence reviewer", async () => {
  const model = evidenceModel([{ claims: brief.claims }, { verdicts: [] }]);
  await assert.rejects(
    generateLocalDecisionBrief({ ...generationInput, model }),
  );
  assert.equal(model.doGenerateCalls.length, 2);
});
