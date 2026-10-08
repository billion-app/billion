import assert from "node:assert/strict";
import test from "node:test";

import { createTavilySearch } from "./tavily-search.js";

const usage = (used = 0, keyLimit: number | null = null) =>
  Response.json({
    key: { usage: used, limit: keyLimit },
    account: { plan_usage: used, plan_limit: 1000 },
  });
const found = () =>
  Response.json({
    results: [
      {
        title: "Official source",
        url: "https://example.gov/bill",
        content: "Evidence",
      },
    ],
  });

test("concurrent repeated queries spend one search credit", async (t) => {
  let searches = 0;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    if (String(url).endsWith("/usage")) return usage();
    searches++;
    return found();
  });
  const search = createTavilySearch();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => search("  bill   history ", "key")),
  );
  assert.equal(searches, 1);
  assert.equal(results[0]?.sources[0]?.url, "https://example.gov/bill");
});

test("concurrent distinct searches share the ten-credit process budget", async (t) => {
  let searches = 0;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    if (String(url).endsWith("/usage")) return usage();
    searches++;
    return found();
  });
  const search = createTavilySearch();
  const results = await Promise.allSettled(
    Array.from({ length: 30 }, (_, i) => search(`bill ${i}`, "key")),
  );
  assert.equal(searches, 10);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 10);
});

for (const [label, used, keyLimit, expected] of [
  ["monthly reserve", 798, null, 2],
  ["key limit", 3, 4, 1],
  ["exhausted account", 1000, null, 0],
] as const) {
  test(`respects ${label} before spending credits`, async (t) => {
    let searches = 0;
    t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
      if (String(url).endsWith("/usage")) return usage(used, keyLimit);
      searches++;
      return found();
    });
    const search = createTavilySearch();
    await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => search(`bill ${i}`, "key")),
    );
    assert.equal(searches, expected);
  });
}

test("failed usage checks stop searches", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    assert.ok(String(url).endsWith("/usage"));
    return new Response("unavailable", { status: 503 });
  });
  const search = createTavilySearch();
  await assert.rejects(search("bill", "key"), /usage check failed/);
  await assert.rejects(search("other bill", "key"), /usage check failed/);
});

test("credit-limit failures stop subsequent requests", async (t) => {
  let searches = 0;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    if (String(url).endsWith("/usage")) return usage();
    searches++;
    return new Response("exhausted", { status: 432 });
  });
  const search = createTavilySearch();
  await assert.rejects(search("bill", "key"), /HTTP 432/);
  await assert.rejects(search("other bill", "key"), /HTTP 432/);
  assert.equal(searches, 1);
});
