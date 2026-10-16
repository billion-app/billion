import assert from "node:assert/strict";
import test from "node:test";

import type { ResearchStore, SourceDocument } from "./store.js";
import { createResearchLibrary } from "./library.js";
import { createSharedResearch, researchKey } from "./shared.js";

const fixed = new Date("2026-10-07T12:00:00Z");
function memoryStore(now = () => fixed): ResearchStore {
  const cache = new Map<string, { value: unknown; expiresAt: Date }>();
  const docs = new Map<string, SourceDocument>();
  return {
    async get(key) {
      const row = cache.get(key);
      return row && row.expiresAt > now() ? row.value : undefined;
    },
    async set(key, value, expiresAt) {
      cache.set(key, { value, expiresAt });
    },
    async document(url) {
      const d = docs.get(url);
      return d && d.expiresAt > now() ? d : undefined;
    },
    async saveDocument(document) {
      docs.set(document.url, document);
    },
    async find(query) {
      return [...docs.values()]
        .filter((d) => d.expiresAt > now() && d.body.includes(query))
        .slice(0, 5);
    },
  };
}
const discovered = {
  text: "Search snippet is not evidence",
  sources: [
    {
      sourceType: "url" as const,
      title: "Analysis",
      url: "https://example.org/analysis",
    },
  ],
};

test("persistent query/page reuse survives a new library instance and deduplicates concurrent requests", async () => {
  const store = memoryStore();
  let searches = 0,
    downloads = 0;
  const options = {
    store,
    namespace: "searxng",
    now: () => fixed,
    discover: async () => {
      searches++;
      return discovered;
    },
    retrieve: async (url: string) => {
      downloads++;
      return {
        url,
        title: "Analysis",
        body: "Documented public policy precedent",
      };
    },
  };
  const first = createResearchLibrary(options);
  await Promise.all(
    Array.from({ length: 6 }, () => first.search("rent   protections", true)),
  );
  await Promise.all(
    Array.from({ length: 6 }, () =>
      first.page("https://example.org/analysis#section"),
    ),
  );
  const restarted = createResearchLibrary(options);
  await restarted.search("rent protections", true);
  await restarted.page("https://example.org/analysis");
  assert.equal(searches, 1);
  assert.equal(downloads, 1);
  const local = await restarted.search("public policy");
  assert.match(local.text, /Previously retrieved/);
  assert.equal(searches, 1);
  await restarted.search("public policy", true);
  assert.equal(searches, 2, "explicit evidence gap permits discovery");
});

test("expiry, provider identity and failed discovery remain retryable", async () => {
  let current = fixed;
  const store = memoryStore(() => current);
  let searches = 0;
  const options = {
    store,
    now: () => current,
    discover: async () => {
      searches++;
      return discovered;
    },
  };
  await createResearchLibrary({ ...options, namespace: "tavily" }).search(
    "history",
    true,
  );
  await createResearchLibrary({ ...options, namespace: "searxng" }).search(
    "history",
    true,
  );
  current = new Date(fixed.getTime() + 86_400_001);
  await createResearchLibrary({ ...options, namespace: "tavily" }).search(
    "history",
    true,
  );
  assert.equal(searches, 3);
  let attempts = 0;
  const failed = createResearchLibrary({
    store,
    namespace: "failed",
    discover: async () => {
      if (++attempts === 1) throw new Error("outage");
      return discovered;
    },
  });
  await assert.rejects(failed.search("history", true), /outage/);
  await failed.search("history", true);
  assert.equal(attempts, 2);
});

test("a revision produces one shared collection; snippets and failed pages never become citations", async () => {
  const store = memoryStore();
  let searches = 0,
    runs = 0;
  const library = createResearchLibrary({
    store,
    namespace: "searxng",
    now: () => fixed,
    discover: async () => {
      searches++;
      return discovered;
    },
    retrieve: async (url) => {
      if (url.endsWith("broken")) throw new Error("blocked");
      return {
        url,
        title: "Analysis",
        body: "Verified analysis of the statutory mechanism and earlier attempts.",
      };
    },
  });
  const run = async (
    _input: unknown,
    tools: Parameters<Parameters<typeof createSharedResearch>[0]["run"]>[1],
  ) => {
    runs++;
    await tools.web_search.execute!(
      { query: "earlier attempts", discover: true },
      {} as never,
    );
    await tools.fetch_page.execute!(
      { url: "https://example.org/broken" },
      {} as never,
    );
    await tools.fetch_page.execute!(
      { url: "https://example.org/analysis" },
      {} as never,
    );
    return "Historical context and attributed perspectives from opened sources.";
  };
  const input = {
    title: "Housing bill",
    type: "bill",
    fullText: "Original legislation",
    sourceUrl: "https://example.gov/bill",
  };
  const shared = createSharedResearch({
    store,
    library,
    run,
    now: () => fixed,
  });
  const [context, perspectives] = await Promise.all([
    shared(input),
    shared(input),
  ]);
  assert.equal(runs, 1);
  assert.deepEqual(context, perspectives);
  assert.deepEqual(
    context.sources.map((s) => s.url),
    [input.sourceUrl, "https://example.org/analysis"],
  );
  const restarted = createSharedResearch({
    store,
    library,
    run,
    now: () => fixed,
  });
  assert.deepEqual(await restarted(input), context);
  assert.equal(runs, 1);
  await restarted({ ...input, fullText: "Amended legislation" });
  assert.equal(runs, 2);
  assert.equal(
    searches,
    1,
    "changed revisions reuse unchanged external discovery",
  );
  assert.notEqual(
    researchKey(input),
    researchKey({ ...input, fullText: "Amended legislation" }),
  );
});

test("empty research and unopened search results do not poison the revision cache", async () => {
  const store = memoryStore();
  let runs = 0;
  const library = createResearchLibrary({
    store,
    namespace: "test",
    discover: async () => discovered,
  });
  const research = createSharedResearch({
    store,
    library,
    run: async () => {
      runs++;
      return "Unsupported notes";
    },
  });
  const input = { title: "Bill", type: "bill", fullText: "Source" };
  assert.deepEqual(await research(input), { notes: "", sources: [] });
  await research(input);
  assert.equal(runs, 2);
});
