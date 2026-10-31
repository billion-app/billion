import assert from "node:assert/strict";
import test from "node:test";

import type { ResearchStore, SourceDocument } from "../research/store.js";
import { createResearchLibrary } from "../research/library.js";
import { createCaliforniaResearchLibrary } from "./california-library.js";

const now = new Date("2026-10-30T12:00:00Z");
function memoryStore(): ResearchStore {
  const cache = new Map<string, { value: unknown; expiresAt: Date }>();
  const documents = new Map<string, SourceDocument>();
  return {
    async get(key) {
      const row = cache.get(key);
      return row && row.expiresAt > now ? row.value : undefined;
    },
    async set(key, value, expiresAt) {
      cache.set(key, { value, expiresAt });
    },
    async document(url) {
      return documents.get(url);
    },
    async saveDocument(document) {
      documents.set(document.url, document);
    },
    async find(query) {
      return [...documents.values()].filter((doc) => doc.body.includes(query));
    },
  };
}
const result = (name: string) => ({
  text: name,
  sources: [{ sourceType: "url" as const, url: `https://example.org/${name}` }],
});

test("California bypasses legacy discovery and reuses only matching provider configuration", async () => {
  const store = memoryStore();
  await createResearchLibrary({
    store,
    now: () => now,
    namespace: "california-candidate-research-v1",
    discover: async () => result("legacy-tavily"),
  }).search("candidate policies", true);

  const calls: string[] = [];
  const library = (provider: string, baseUrl: string, name: string) =>
    createCaliforniaResearchLibrary(
      {
        store,
        now: () => now,
        discover: async () => {
          calls.push(name);
          return result(name);
        },
      },
      {
        SCRAPER_SEARCH_PROVIDER: provider,
        SCRAPER_SEARXNG_BASE_URL: baseUrl,
      },
    );
  const local = library("searxng", "http://localhost:8080", "local");
  assert.deepEqual(
    await local.search("candidate   policies", true),
    result("local"),
  );
  assert.deepEqual(calls, ["local"]);
  assert.deepEqual(
    await library("searxng", "http://localhost:8080", "unused").search(
      "candidate policies",
      true,
    ),
    result("local"),
  );
  assert.deepEqual(calls, ["local"]);
  assert.deepEqual(
    await library("searxng", "http://localhost:8081", "other-local").search(
      "candidate policies",
      true,
    ),
    result("other-local"),
  );
  assert.deepEqual(
    await library("tavily", "http://localhost:8080", "explicit-tavily").search(
      "candidate policies",
      true,
    ),
    result("explicit-tavily"),
  );
  assert.deepEqual(calls, ["local", "other-local", "explicit-tavily"]);
});

test("California keeps retrieved documents reusable across discovery providers", async () => {
  const store = memoryStore();
  let downloads = 0;
  let discoveries = 0;
  const options = {
    store,
    now: () => now,
    discover: async () => {
      discoveries++;
      return result("discovery");
    },
    retrieve: async (url: string) => {
      downloads++;
      return { url, title: "Official source", body: "candidate policies" };
    },
  };
  const first = createCaliforniaResearchLibrary(options, {
    SCRAPER_SEARCH_PROVIDER: "tavily",
  });
  const document = await first.page("https://example.org/official");
  const local = createCaliforniaResearchLibrary(options, {
    SCRAPER_SEARCH_PROVIDER: "searxng",
    SCRAPER_SEARXNG_BASE_URL: "http://localhost:8080",
  });
  assert.deepEqual(await local.page(document.url), document);
  assert.deepEqual((await local.search("candidate policies")).sources, [
    { sourceType: "url", title: "Official source", url: document.url },
  ]);
  assert.equal(downloads, 1);
  assert.equal(discoveries, 0);
});

test("California retries failed and empty discovery without caching either outcome", async () => {
  let attempts = 0;
  const library = createCaliforniaResearchLibrary(
    {
      store: memoryStore(),
      now: () => now,
      discover: async () => {
        attempts++;
        if (attempts === 1) throw new Error("upstream unavailable");
        if (attempts === 2) return { text: "", sources: [] };
        return result("recovered");
      },
    },
    {
      SCRAPER_SEARCH_PROVIDER: "searxng",
      SCRAPER_SEARXNG_BASE_URL: "http://localhost:8080",
    },
  );
  await assert.rejects(library.search("candidate policies", true));
  assert.deepEqual(await library.search("candidate policies", true), {
    text: "",
    sources: [],
  });
  assert.deepEqual(
    await library.search("candidate policies", true),
    result("recovered"),
  );
  await library.search("candidate policies", true);
  assert.equal(attempts, 3);
});

test("California selects Mwmbl locally and bypasses the old unprofiled cache", async () => {
  const store = memoryStore();
  const configuration = {
    SCRAPER_SEARCH_PROVIDER: "searxng",
    SCRAPER_SEARXNG_BASE_URL: "http://localhost:8080",
  };
  await createResearchLibrary({
    store,
    now: () => now,
    namespace: JSON.stringify([
      "california-candidate-research-v2",
      configuration.SCRAPER_SEARCH_PROVIDER,
      configuration.SCRAPER_SEARXNG_BASE_URL,
    ]),
    discover: async () => result("old-general"),
  }).search("Mike McGuire", true);
  const calls: (readonly string[] | undefined)[] = [];
  const options = {
    store,
    now: () => now,
    discover: async (_query: string, engines?: readonly string[]) => {
      calls.push(engines);
      return result("mwmbl");
    },
  };
  assert.deepEqual(
    await createCaliforniaResearchLibrary(options, configuration).search(
      "Mike McGuire",
      true,
    ),
    result("mwmbl"),
  );
  await createCaliforniaResearchLibrary(options, configuration).search(
    "Mike McGuire",
    true,
  );
  assert.deepEqual(calls, [["mwmbl"]]);
  await createCaliforniaResearchLibrary(options, {
    SCRAPER_SEARCH_PROVIDER: "tavily",
  }).search("Mike McGuire", true);
  assert.deepEqual(calls, [["mwmbl"], undefined]);
});
