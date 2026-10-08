import assert from "node:assert/strict";
import test from "node:test";

import { searchSearxng } from "./searxng-search.js";

test("SearXNG uses JSON HTTP search and retains only HTTP source citations", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: URL, init: RequestInit) => {
    assert.equal(url.toString(), "http://search.internal/base/search");
    assert.equal(init.method, "POST");
    assert.equal(
      new URLSearchParams(init.body as URLSearchParams).get("format"),
      "json",
    );
    return Response.json({
      results: [
        {
          title: "Official",
          url: "https://example.gov/bill",
          content: "Source snippet",
        },
        { title: "Bad", url: "file:///etc/passwd" },
        { title: "Credentials", url: "https://secret:password@example.org" },
      ],
    });
  });
  const result = await searchSearxng(
    "bill history",
    "http://search.internal/base/",
  );
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0]?.url, "https://example.gov/bill");
  assert.match(result.text, /Source snippet/);
});

test("blocked upstreams and failed requests do not masquerade as successful empty searches", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      results: [],
      unresponsive_engines: [["duckduckgo", "CAPTCHA"]],
    }),
  );
  await assert.rejects(
    searchSearxng("history", "http://search.internal"),
    /upstream engines/,
  );
});
