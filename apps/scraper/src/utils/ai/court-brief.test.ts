import assert from "node:assert/strict";
import test from "node:test";
import { APICallError } from "ai";
import { MockLanguageModelV3 } from "ai/test";

import { parseCourtBriefRecord } from "@acme/validators";

import { generateCourtBrief, validateCourtBrief } from "./court-brief.js";
import {
  emergency,
  emergencyOutput,
  fixtureModel,
  merits,
  meritsOutput,
  separate,
  separateOutput,
} from "./fixtures/court-brief-fixtures.js";
import { AIRateLimitError, setRateLimitHit } from "./text-generation.js";

void test("26A305 stays interim; merits and separately published opinions validate with document hashes", () => {
  const order = validateCourtBrief(emergencyOutput, emergency, "fixture");
  assert.equal(order.proceeding, "emergency_order");
  assert.equal(order.verifiedQuotes, 1);
  assert.match(order.unknowns[0]!, /does not finally resolve/);
  assert.deepEqual(
    order.opinions.map((opinion) => opinion.kind),
    ["concurrence", "dissent"],
  );
  assert.equal(
    validateCourtBrief(meritsOutput, merits, "fixture").proceeding,
    "merits_opinion",
  );
  const opinions = validateCourtBrief(separateOutput, separate, "fixture");
  assert.equal(opinions.sources.length, 3);
  assert.equal(opinions.verifiedQuotes, 3);
  assert.notEqual(
    opinions.sources[1]?.contentHash,
    opinions.sources[2]?.contentHash,
  );
  assert.throws(
    () =>
      validateCourtBrief(
        { ...emergencyOutput, reasoning: meritsOutput.reasoning },
        emergency,
        "fixture",
      ),
    /merits holding/,
  );
});

void test("unknown evidence remains sparse; unknown citations fail and unverifiable or wrong-document quotes are removed", () => {
  const sparse = validateCourtBrief(
    {
      ...emergencyOutput,
      takeaway: {
        text: "A stay request was denied.",
        documentIds: ["document-1"],
        quote: null,
      },
      action: {
        text: "The stay request was denied.",
        documentIds: ["document-1"],
        quote: null,
      },
      posture:
        "The short record does not establish the underlying case or scope of the request.",
      questions: [],
      reasoning: [],
      effects: [],
      opinions: [],
      unknowns: [
        "The short record does not explain the denial or resolve the underlying merits.",
      ],
    },
    {
      ...emergency,
      data: {
        ...emergency.data,
        caseNumber: "TEST-unknown",
        status: null,
        fullText: "The application for stay is denied.",
      },
    },
    "fixture",
  );
  assert.equal(sparse.proceeding, "unknown");
  assert.equal(sparse.opinions.length, 0);
  const invalid = structuredClone(separateOutput);
  invalid.opinions[0]!.quote!.documentId = "document-3";
  invalid.action.quote!.text =
    "The judgment was unanimously affirmed by all nine Justices.";
  const verified = validateCourtBrief(invalid, separate, "fixture");
  assert.equal(verified.action.quote, null);
  assert.equal(verified.opinions[0]?.quote, null);
  assert.equal(verified.verifiedQuotes, 1);
  const fragment = {
    ...meritsOutput,
    action: {
      ...meritsOutput.action,
      quote: {
        text: "The judgment of the Court of Appeal",
        documentId: "document-1",
        locator: null,
      },
    },
  };
  assert.equal(
    validateCourtBrief(fragment, merits, "fixture").action.quote,
    null,
  );
  assert.throws(
    () =>
      validateCourtBrief(
        {
          ...emergencyOutput,
          action: { ...emergencyOutput.action, documentIds: ["invented"] },
        },
        emergency,
        "fixture",
      ),
    /unknown document/,
  );
  const record = validateCourtBrief(emergencyOutput, emergency, "fixture");
  assert.equal(parseCourtBriefRecord(record, "stale"), null);
  assert.equal(
    parseCourtBriefRecord({ ...record, version: 999 }, emergency.contentHash),
    null,
  );
  assert.equal(
    parseCourtBriefRecord(
      { ...record, generatorVersion: "old" },
      emergency.contentHash,
    ),
    null,
  );
  assert.equal(parseCourtBriefRecord({}, emergency.contentHash), null);
});

void test("real structured generation retries invalid output once and remains retryable after two failures", async () => {
  const model = fixtureModel([{}, emergencyOutput]);
  const brief = await generateCourtBrief(emergency, model);
  assert.equal(brief?.proceeding, "emergency_order");
  assert.equal(model.doGenerateCalls.length, 2);
  assert.equal(brief?.modelVersion, "fixture:court-brief-test");
  const invalid = fixtureModel([{}, {}]);
  assert.equal(await generateCourtBrief(emergency, invalid), null);
  assert.equal(invalid.doGenerateCalls.length, 2);
});

void test("rate limiting defers the item and stops further provider calls", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: async () => {
      throw new APICallError({
        message: "rate limit",
        url: "https://example.org",
        requestBodyValues: {},
        statusCode: 429,
        isRetryable: false,
      });
    },
  });
  try {
    await assert.rejects(
      generateCourtBrief(emergency, model),
      AIRateLimitError,
    );
    assert.equal(model.doGenerateCalls.length, 1);
    await assert.rejects(
      generateCourtBrief(emergency, model),
      AIRateLimitError,
    );
    assert.equal(model.doGenerateCalls.length, 1);
  } finally {
    setRateLimitHit(false);
  }
});
