import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("retained finance transport rejects the actual dropped-Mechanisms output", async (t) => {
  const fixture = await copyFailureFixture();
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
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return Response.json({
      id: "offline-captured-failure-response",
      created_at: 1,
      model: "gpt-6-luna",
      object: "response",
      status: "completed",
      output: [
        {
          id: "offline-captured-failure-message",
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(fixture.failedOutput),
              annotations: [],
            },
          ],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
    });
  });
  const call = {
    role: "author" as const,
    system: "Offline retained-finance schema replay.",
    prompt: JSON.stringify({ retainedNarrative: fixture.narrative }),
    maxOutputTokens: 8000,
    authorEvidence: fixture.authorEvidence,
    retainedNarrative: fixture.narrative,
  };
  await assert.rejects(invokeCaliforniaModel(call), (error: unknown) => {
    assert(error instanceof CaliforniaModelInvocationError);
    assert.deepEqual(error.diagnostic.parsedOutput, fixture.failedOutput);
    return true;
  });
  assert.equal(requests, 1);
});
