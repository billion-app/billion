import assert from "node:assert/strict";
import test from "node:test";
import type { TestContext } from "node:test";
import { generateText, Output } from "ai";
import { z } from "zod";

const keys = [
  "LOCAL_LLM_BASE_URL",
  "OPENROUTER_API_KEY",
  "DEEPSEEK_API_KEY",
  "SCRAPER_FALLBACK_BASE_URL",
  "SCRAPER_FALLBACK_MODEL",
  "SCRAPER_FALLBACK_API_KEY",
];
let sequence = 0;
async function setup(t: TestContext, env: Record<string, string>) {
  const before = { ...process.env };
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, env);
  t.after(() => {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  });
  return import(`./provider.ts?test=${sequence++}`);
}

function response(text: string, annotations: unknown[] = []) {
  return Response.json({
    id: "resp_test",
    created_at: 1,
    model: "gpt-6-luna",
    object: "response",
    status: "completed",
    output: [
      {
        id: "msg_test",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text, annotations }],
      },
    ],
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
  });
}
const fallback = { SCRAPER_FALLBACK_BASE_URL: "http://proxy.test/v1" };

for (const primary of ["OPENROUTER_API_KEY", "DEEPSEEK_API_KEY"]) {
  test(`${primary} failure falls back to configured Responses URL and model`, async (t) => {
    const provider = await setup(t, {
      ...fallback,
      [primary]: "test-key",
      SCRAPER_FALLBACK_MODEL: "gpt-6-luna",
      SCRAPER_FALLBACK_API_KEY: "proxy-key",
    });
    const calls: string[] = [];
    t.mock.method(
      globalThis,
      "fetch",
      async (url: string, init: RequestInit) => {
        calls.push(String(url));
        if (!String(url).startsWith("http://proxy.test"))
          return new Response("unavailable", { status: 429 });
        const body = JSON.parse(init.body as string);
        assert.equal(body.model, "gpt-6-luna");
        assert.equal(body.store, false);
        assert.equal(
          new Headers(init.headers).get("authorization"),
          "Bearer proxy-key",
        );
        return response("fallback worked");
      },
    );
    const result = await generateText({
      model: provider.getTextLlm(),
      prompt: "hello",
      maxRetries: 0,
    });
    assert.equal(result.text, "fallback worked");
    assert.equal(result.usage.inputTokens, 10);
    assert.equal(calls.length, 2);
    assert.equal(calls[1], "http://proxy.test/v1/responses");
    assert.ok(!provider.getTextModelVersion().includes("fallback"));
  });
}

test("healthy primary does not call fallback", async (t) => {
  const provider = await setup(t, { ...fallback, DEEPSEEK_API_KEY: "test" });
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.ok(!String(url).includes("proxy.test"));
    return Response.json({
      id: "chat_test",
      created: 1,
      model: "deepseek-v4-flash",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "primary" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
  });
  assert.equal(
    (
      await generateText({
        model: provider.getTextLlm(),
        prompt: "hello",
        maxRetries: 0,
      })
    ).text,
    "primary",
  );
});

test("brief schema reaches fallback and output is validated", async (t) => {
  const provider = await setup(t, { ...fallback, OPENROUTER_API_KEY: "test" });
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (!String(url).includes("proxy.test"))
      return new Response("down", { status: 503 });
    const body = JSON.parse(init.body as string);
    assert.equal(body.text.format.type, "json_schema");
    assert.ok(body.text.format.schema.properties.hook);
    return response('{"hook":"A sourced brief"}');
  });
  const result = await generateText({
    model: provider.getStructuredLlm(),
    prompt: "brief",
    output: Output.object({ schema: z.object({ hook: z.string() }) }),
    maxRetries: 0,
  });
  assert.equal(result.output.hook, "A sourced brief");
});

test("search fallback replaces native tool and preserves citation URLs", async (t) => {
  const provider = await setup(t, { ...fallback, OPENROUTER_API_KEY: "test" });
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (!String(url).includes("proxy.test"))
      return new Response("down", { status: 503 });
    const body = JSON.parse(init.body as string);
    assert.equal(body.tools[0].type, "web_search");
    return response("Found evidence", [
      {
        type: "url_citation",
        start_index: 0,
        end_index: 5,
        title: "Source",
        url: "https://example.com/source",
      },
    ]);
  });
  const result = await provider.generateWebSearch("find evidence");
  assert.equal(result.sources[0]?.sourceType, "url");
  assert.equal(
    (result.sources[0] as { url: string }).url,
    "https://example.com/source",
  );
});

test("disabled fallback preserves primary failure", async (t) => {
  const provider = await setup(t, { DEEPSEEK_API_KEY: "test" });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response("down", { status: 503 });
  });
  await assert.rejects(
    generateText({
      model: provider.getTextLlm(),
      prompt: "hello",
      maxRetries: 0,
    }),
  );
  assert.equal(calls, 1);
});

test("both providers failing propagates the fallback error", async (t) => {
  const provider = await setup(t, { ...fallback, DEEPSEEK_API_KEY: "test" });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response("down", { status: 503 });
  });
  await assert.rejects(
    generateText({
      model: provider.getTextLlm(),
      prompt: "hello",
      maxRetries: 0,
    }),
  );
  assert.equal(calls, 2);
});

test("local primary remains ahead of OpenRouter and the fallback", async (t) => {
  const provider = await setup(t, {
    ...fallback,
    LOCAL_LLM_BASE_URL: "http://ollama.test/v1",
    OPENROUTER_API_KEY: "test",
  });
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(String(url));
    if (String(url).includes("proxy.test")) return response("third provider");
    return new Response("down", { status: 503 });
  });
  const result = await generateText({
    model: provider.getTextLlm(),
    prompt: "hello",
    maxRetries: 0,
  });
  assert.equal(result.text, "third provider");
  assert.ok(calls[0]?.startsWith("http://ollama.test"));
  assert.ok(calls[1]?.startsWith("https://openrouter.ai"));
  assert.equal(calls[2], "http://proxy.test/v1/responses");
});

test("fallback can run alone with default model and no secret", async (t) => {
  const provider = await setup(t, fallback);
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(String(url), "http://proxy.test/v1/responses");
    assert.equal(JSON.parse(init.body as string).model, "gpt-6-luna");
    return response("standalone");
  });
  assert.equal(
    (
      await generateText({
        model: provider.getStructuredLlm(),
        prompt: "hello",
        maxRetries: 0,
      })
    ).text,
    "standalone",
  );
  assert.equal(provider.getTextModelVersion(), "fallback:gpt-6-luna");
});

test("cancellation never starts a fallback request", async (t) => {
  const provider = await setup(t, { ...fallback, DEEPSEEK_API_KEY: "test" });
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    controller.abort();
    throw new DOMException("cancelled", "AbortError");
  });
  await assert.rejects(
    generateText({
      model: provider.getTextLlm(),
      prompt: "hello",
      maxRetries: 0,
      abortSignal: controller.signal,
    }),
  );
  assert.equal(calls, 1);
});
