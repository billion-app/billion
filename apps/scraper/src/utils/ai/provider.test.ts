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
  "TAVILY_API_KEY",
  "SCRAPER_SEARCH_PROVIDER",
  "SCRAPER_SEARXNG_BASE_URL",
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

for (const primary of [
  "OPENROUTER_API_KEY",
  "DEEPSEEK_API_KEY",
  "LOCAL_LLM_BASE_URL",
]) {
  test(`${primary} failure retries the Responses fallback`, async (t) => {
    const provider = await setup(t, {
      ...fallback,
      [primary]:
        primary === "LOCAL_LLM_BASE_URL" ? "http://local.test/v1" : "test-key",
    });
    const calls: string[] = [];
    t.mock.method(
      globalThis,
      "fetch",
      async (url: string, init: RequestInit) => {
        calls.push(String(url));
        if (!String(url).startsWith("http://proxy.test/"))
          return new Response("unavailable", { status: 503 });
        const body = JSON.parse(init.body as string);
        assert.equal(body.model, "gpt-6-luna");
        assert.equal(body.store, false);
        assert.equal(body.reasoning.effort, "none");
        return response("fallback works");
      },
    );
    assert.equal(
      (
        await generateText({
          model: provider.getTextLlm(),
          prompt: "hello",
          maxRetries: 0,
        })
      ).text,
      "fallback works",
    );
    assert.equal(calls.length, 2);
    assert.equal(calls[1], "http://proxy.test/v1/responses");
    assert.ok(!provider.getTextModelVersion().includes("fallback:"));
  });
}

test("structured generation falls back with JSON schema", async (t) => {
  const provider = await setup(t, { ...fallback, OPENROUTER_API_KEY: "test" });
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (!String(url).startsWith("http://proxy.test/"))
      return new Response("unavailable", { status: 503 });
    assert.equal(
      JSON.parse(init.body as string).text.format.type,
      "json_schema",
    );
    return response('{"answer":"yes"}');
  });
  const result = await generateText({
    model: provider.getStructuredLlm(),
    prompt: "hello",
    output: Output.object({ schema: z.object({ answer: z.string() }) }),
    maxRetries: 0,
  });
  assert.deepEqual(result.output, { answer: "yes" });
  assert.equal(
    provider.getStructuredLlmCandidates().at(-1)?.modelVersion,
    "fallback:gpt-6-luna",
  );
});

test("native search fallback preserves URL citations", async (t) => {
  const provider = await setup(t, { ...fallback, OPENROUTER_API_KEY: "test" });
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (!String(url).startsWith("http://proxy.test/"))
      return new Response("unavailable", { status: 503 });
    assert.equal(
      JSON.parse(init.body as string).tools[0].type,
      "web_search_preview",
    );
    return response("A source", [
      {
        type: "url_citation",
        start_index: 0,
        end_index: 8,
        url: "https://example.com/evidence",
        title: "Evidence",
      },
    ]);
  });
  const result = await provider.generateWebSearch("find evidence");
  assert.equal(result.sources[0]?.sourceType, "url");
  assert.equal(
    (result.sources[0] as { url: string }).url,
    "https://example.com/evidence",
  );
});

test("fallback alone and default model work without credentials", async (t) => {
  const provider = await setup(t, fallback);
  t.mock.method(globalThis, "fetch", async () => response("standalone"));
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

test("unset fallback never sends a proxy request", async (t) => {
  const provider = await setup(t, { OPENROUTER_API_KEY: "test" });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls++;
    assert.ok(!String(url).includes("proxy.test"));
    return new Response("unavailable", { status: 503 });
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

test("cancellation does not trigger fallback", async (t) => {
  const provider = await setup(t, { ...fallback, OPENROUTER_API_KEY: "test" });
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

test("healthy primary does not invoke fallback", async (t) => {
  const provider = await setup(t, { ...fallback, OPENROUTER_API_KEY: "test" });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls++;
    assert.ok(!String(url).includes("proxy.test"));
    return Response.json({
      id: "chat_test",
      object: "chat.completion",
      created: 1,
      model: "deepseek/deepseek-v4-flash",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "primary" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
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
  assert.equal(calls, 1);
});

test("uncited fallback search is rejected", async (t) => {
  const provider = await setup(t, fallback);
  t.mock.method(globalThis, "fetch", async () => response("I cannot search"));
  await assert.rejects(
    provider.generateWebSearch("find evidence"),
    /no web-search citations/,
  );
});

test("preferred Tavily searches directly with one-credit settings and source snippets", async (t) => {
  const provider = await setup(t, {
    TAVILY_API_KEY: "test-search-key",
    SCRAPER_SEARCH_PROVIDER: "tavily",
    OPENROUTER_API_KEY: "test",
    ...fallback,
  });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls++;
    assert.equal(String(url), "https://api.tavily.com/search");
    assert.equal(
      (init.headers as Record<string, string>).Authorization,
      "Bearer test-search-key",
    );
    assert.deepEqual(JSON.parse(init.body as string), {
      query: "official bill history",
      search_depth: "basic",
      auto_parameters: false,
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
    });
    assert.ok(init.signal);
    return Response.json({
      answer: "Do not use a generated answer",
      results: [
        {
          title: "Official record",
          url: "https://congress.gov/bill/example",
          content: "Source snippet",
        },
      ],
    });
  });
  const result = await provider.generateWebSearch("official bill history");
  assert.equal(calls, 1);
  assert.match(result.text, /Source snippet/);
  assert.doesNotMatch(result.text, /generated answer/);
  assert.deepEqual(result.sources, [
    {
      sourceType: "url",
      id: "tavily-0",
      title: "Official record",
      url: "https://congress.gov/bill/example",
    },
  ]);
  assert.deepEqual(result.usage, { inputTokens: 0, outputTokens: 0 });
});

test("hosted failure tries Tavily before unsupported OAuth native search", async (t) => {
  const provider = await setup(t, {
    TAVILY_API_KEY: "test-search-key",
    OPENROUTER_API_KEY: "test",
    ...fallback,
  });
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(String(url));
    if (String(url) === "https://api.tavily.com/search")
      return Response.json({ results: [] });
    return new Response("unavailable", { status: 503 });
  });
  const result = await provider.generateWebSearch("search query");
  assert.equal(calls.length, 2);
  assert.equal(calls[1], "https://api.tavily.com/search");
  assert.deepEqual(result.sources, []);
});

test("exhausted preferred Tavily credits never switch to paid search", async (t) => {
  const provider = await setup(t, {
    TAVILY_API_KEY: "test-search-key",
    SCRAPER_SEARCH_PROVIDER: "tavily",
    OPENROUTER_API_KEY: "test",
    ...fallback,
  });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls++;
    assert.equal(String(url), "https://api.tavily.com/search");
    return new Response("credit limit", { status: 432 });
  });
  await assert.rejects(
    provider.generateWebSearch("query"),
    /Tavily search failed \(HTTP 432\)/,
  );
  assert.equal(calls, 1);
});

test("preferred Tavily without a key fails before any provider request", async (t) => {
  const provider = await setup(t, {
    SCRAPER_SEARCH_PROVIDER: "tavily",
    OPENROUTER_API_KEY: "test",
  });
  t.mock.method(globalThis, "fetch", async () => {
    assert.fail("No request expected");
  });
  await assert.rejects(
    provider.generateWebSearch("query"),
    /TAVILY_API_KEY is required/,
  );
});

test("Tavily rejects invalid source URLs and caps returned results", async (t) => {
  const provider = await setup(t, {
    TAVILY_API_KEY: "test",
    SCRAPER_SEARCH_PROVIDER: "tavily",
  });
  let invalid = true;
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      results: Array.from({ length: 7 }, (_, i) => ({
        title: "Source",
        url: invalid ? "javascript:alert(1)" : `https://example.com/${i}`,
        content: "snippet".repeat(1000),
      })),
    }),
  );
  await assert.rejects(provider.generateWebSearch("query"));
  invalid = false;
  const result = await provider.generateWebSearch("query");
  assert.equal(result.sources.length, 5);
  assert.ok(result.text.length <= 1500);
});

test("hosted and Tavily failures continue to cited Responses search", async (t) => {
  const provider = await setup(t, {
    TAVILY_API_KEY: "test-search-key",
    OPENROUTER_API_KEY: "test",
    ...fallback,
  });
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(String(url));
    if (String(url) === "https://api.tavily.com/search")
      return new Response("credit limit", { status: 432 });
    if (String(url).startsWith("http://proxy.test/"))
      return response("Official evidence", [
        {
          type: "url_citation",
          start_index: 0,
          end_index: 17,
          url: "https://congress.gov/bill/example",
          title: "Official record",
        },
      ]);
    return new Response("unavailable", { status: 503 });
  });
  const result = await provider.generateWebSearch("query");
  assert.equal(calls.length, 3);
  assert.equal(calls[1], "https://api.tavily.com/search");
  assert.equal(calls[2], "http://proxy.test/v1/responses");
  assert.equal(result.sources[0]?.sourceType, "url");
});

test("preferred SearXNG bypasses hosted and Tavily providers", async (t) => {
  const provider = await setup(t, {
    SCRAPER_SEARCH_PROVIDER: "searxng",
    SCRAPER_SEARXNG_BASE_URL: "http://search.test/",
    TAVILY_API_KEY: "test",
    OPENROUTER_API_KEY: "test",
    ...fallback,
  });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: URL) => {
    calls++;
    assert.equal(String(url), "http://search.test/search");
    return Response.json({
      results: [
        {
          title: "Official",
          url: "https://example.gov/analysis",
          content: "Evidence",
        },
      ],
    });
  });
  assert.equal(
    (await provider.generateWebSearch("bill analysis")).sources.length,
    1,
  );
  assert.equal(calls, 1);
});

test("SearXNG outage never activates a paid fallback", async (t) => {
  const provider = await setup(t, {
    SCRAPER_SEARCH_PROVIDER: "searxng",
    SCRAPER_SEARXNG_BASE_URL: "http://search.test/",
    TAVILY_API_KEY: "test",
    OPENROUTER_API_KEY: "test",
    ...fallback,
  });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: URL) => {
    calls++;
    assert.equal(String(url), "http://search.test/search");
    return new Response("blocked", { status: 503 });
  });
  await assert.rejects(
    provider.generateWebSearch("analysis"),
    /SearXNG search failed/,
  );
  assert.equal(calls, 1);
});

test("SearXNG without an endpoint fails before requesting any provider", async (t) => {
  const provider = await setup(t, {
    SCRAPER_SEARCH_PROVIDER: "searxng",
    TAVILY_API_KEY: "test",
    ...fallback,
  });
  t.mock.method(globalThis, "fetch", async () =>
    assert.fail("No provider request expected"),
  );
  await assert.rejects(
    provider.generateWebSearch("analysis"),
    /SCRAPER_SEARXNG_BASE_URL is required/,
  );
});
