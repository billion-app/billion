import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { TestContext } from "node:test";

import {
  californiaAuthorOutputSchema,
  CaliforniaModelInvocationError,
  invokeCaliforniaModel,
} from "./california-ai.js";

async function copyFailureFixture() {
  const fixture = JSON.parse(
    await readFile(
      new URL("./fixtures/retained-finance-copy-failure.json", import.meta.url),
      "utf8",
    ),
  );
  const narrative = californiaAuthorOutputSchema(fixture.authorEvidence).parse(
    fixture.retainedNarrative,
  );
  assert.equal(narrative.mechanisms.claims.length, 3);
  assert.equal(fixture.failedOutput.mechanisms.claims.length, 0);
  return { ...fixture, narrative };
}

interface RequestBody {
  model: string;
  text: {
    format: {
      strict: boolean;
      schema: {
        type: string;
        required: string[];
        properties: Record<string, { type: string; enum?: string[] }>;
        additionalProperties: boolean;
      };
    };
  };
}

function mockResponses(t: TestContext, output: () => unknown) {
  const keys = [
    "SCRAPER_FALLBACK_BASE_URL",
    "SCRAPER_FALLBACK_PRIORITY",
    "SCRAPER_FALLBACK_MODEL",
    "SCRAPER_FALLBACK_REASONING_EFFORT",
    "OPENROUTER_API_KEY",
    "DEEPSEEK_API_KEY",
    "LOCAL_LLM_BASE_URL",
  ];
  const before = { ...process.env };
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, {
    SCRAPER_FALLBACK_BASE_URL: "http://fixture-proxy.test/v1",
    SCRAPER_FALLBACK_PRIORITY: "primary",
    SCRAPER_FALLBACK_MODEL: "gpt-6-luna",
    SCRAPER_FALLBACK_REASONING_EFFORT: "low",
  });
  t.after(() => {
    for (const key of keys)
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
  });
  const bodies: RequestBody[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(new URL(url).hostname, "fixture-proxy.test");
    const body = JSON.parse(String(init.body)) as RequestBody;
    bodies.push(body);
    return Response.json({
      id: "offline-captured-response",
      created_at: 1,
      model: body.model,
      object: "response",
      status: "completed",
      output: [
        {
          id: "offline-captured-message",
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(output()),
              annotations: [],
            },
          ],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
    });
  });
  return bodies;
}

async function retainedCall() {
  const fixture = await copyFailureFixture();
  return {
    fixture,
    call: {
      role: "author" as const,
      system: "Offline retained-finance schema replay.",
      prompt: JSON.stringify({ retainedNarrative: fixture.narrative }),
      maxOutputTokens: 8000,
      authorEvidence: fixture.authorEvidence,
      retainedNarrative: fixture.narrative,
    },
  };
}

test("retained finance transport rejects the actual dropped-Mechanisms output", async (t) => {
  const { fixture, call } = await retainedCall();
  const bodies = mockResponses(t, () => fixture.failedOutput);
  await assert.rejects(invokeCaliforniaModel(call), (error: unknown) => {
    assert(error instanceof CaliforniaModelInvocationError);
    assert.equal(error.diagnostic.parsedOutput, null);
    assert.equal(typeof error.diagnostic.rawText, "string");
    assert.deepEqual(
      JSON.parse(error.diagnostic.rawText!),
      fixture.failedOutput,
    );
    return true;
  });
  assert.equal(bodies.length, 1);
});

test("retained transport sends the exact literal schema and preserves the genuine returned envelope", async (t) => {
  const { fixture, call } = await retainedCall();
  let output: unknown = {
    retainedNarrativeJson: JSON.stringify(fixture.narrative),
  };
  const bodies = mockResponses(t, () => output);
  const result = await invokeCaliforniaModel(call);
  assert.deepEqual(result.output, output);
  assert.equal(result.rawText, JSON.stringify(output));
  const format = bodies[0]!.text.format;
  assert.equal(format.strict, true);
  assert.equal(format.schema.type, "object");
  assert.deepEqual(format.schema.required, ["retainedNarrativeJson"]);
  assert.equal(format.schema.additionalProperties, false);
  assert.deepEqual(format.schema.properties.retainedNarrativeJson, {
    type: "string",
    enum: [JSON.stringify(fixture.narrative)],
  });
  output = fixture.failedOutput;
  const ordinary = await invokeCaliforniaModel({
    ...call,
    retainedNarrative: undefined,
  });
  assert.deepEqual(ordinary.output, fixture.failedOutput);
  assert(bodies[1]!.text.format.schema.required.includes("terms"));
});

test("retained envelopes reject missing, duplicated, reordered or changed political content", async (t) => {
  const { fixture, call } = await retainedCall();
  const variants: unknown[] = [
    {},
    { retainedNarrativeJson: null },
    { retainedNarrativeJson: "not JSON" },
    { retainedNarrativeJson: JSON.stringify(fixture.failedOutput) },
    { retainedNarrativeJson: JSON.stringify(fixture.narrative, null, 2) },
    { retainedNarrativeJson: JSON.stringify(fixture.narrative), extra: true },
  ];
  for (const mutate of [
    (n: typeof fixture.narrative) => n.mechanisms.claims.reverse(),
    (n: typeof fixture.narrative) => {
      n.mechanisms.claims[1] = structuredClone(n.mechanisms.claims[0]!);
    },
    (n: typeof fixture.narrative) => {
      n.mechanisms.claims[0]!.text += " Invented qualifier.";
    },
    (n: typeof fixture.narrative) => {
      n.mechanisms.claims[0]!.evidenceIds = ["candidate-4"];
    },
    (n: typeof fixture.narrative) => {
      n.terms.push({ term: "Changed", plain: "Changed term." });
    },
  ]) {
    const changed = structuredClone(fixture.narrative);
    mutate(changed);
    variants.push({ retainedNarrativeJson: JSON.stringify(changed) });
  }
  let output: unknown;
  mockResponses(t, () => output);
  for (output of variants)
    await assert.rejects(
      invokeCaliforniaModel(call),
      CaliforniaModelInvocationError,
    );
});
