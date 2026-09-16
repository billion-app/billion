import assert from "node:assert/strict";
import test from "node:test";

import {
  createReadContentStore,
  LEGACY_READ_CONTENT_KEY,
  parseReadHistory,
  READ_CONTENT_KEY,
  READ_VISIBILITY_WINDOW_MS,
  visibleArticles,
} from "./read-content";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => Promise.resolve(values.get(key) ?? null),
    setItem: async (key: string, value: string) => {
      await Promise.resolve();
      values.set(key, value);
    },
    value: (key: string) => values.get(key),
  };
}

void test("missing or corrupt history doesn't stop the feed", () => {
  for (const raw of [null, "", "broken", "{}", "[1]"]) {
    assert.deepEqual(parseReadHistory(raw), []);
  }
});

void test("history retains the first valid timestamp and ignores bad entries", () => {
  assert.deepEqual(
    parseReadHistory(
      '[{"id":"a","firstReadAt":10},{"id":"a","firstReadAt":20},{"id":"b","firstReadAt":30},{"id":"bad","firstReadAt":-1}]',
    ),
    [
      { id: "a", firstReadAt: 10 },
      { id: "b", firstReadAt: 30 },
    ],
  );
});

void test("read articles stay visible for 24 hours, then hide", () => {
  const firstReadAt = 1_000;
  const articles = [{ id: "a" }, { id: "b" }, { id: "a" }];
  const history = [{ id: "a", firstReadAt }];

  assert.deepEqual(
    visibleArticles(
      articles,
      history,
      firstReadAt + READ_VISIBILITY_WINDOW_MS - 1,
    ),
    [{ id: "a" }, { id: "b" }],
  );
  assert.deepEqual(
    visibleArticles(articles, history, firstReadAt + READ_VISIBILITY_WINDOW_MS),
    [{ id: "b" }],
  );
});

void test("legacy read IDs migrate with a first-read timestamp", async () => {
  const now = 50_000;
  const storage = memoryStorage({
    [LEGACY_READ_CONTENT_KEY]: '["a","a","b"]',
  });
  const history = await createReadContentStore(storage, () => now).read();
  assert.deepEqual(history, [
    { id: "a", firstReadAt: now },
    { id: "b", firstReadAt: now },
  ]);
  assert.deepEqual(
    JSON.parse(storage.value(READ_CONTENT_KEY) ?? "null"),
    history,
  );
});

void test("repeat visits preserve the first-read timestamp", async () => {
  let now = 100;
  const storage = memoryStorage();
  const store = createReadContentStore(storage, () => now);
  await store.markRead("a");
  now = 200;
  await store.markRead("a");
  await store.markRead("b");
  assert.deepEqual(await store.read(), [
    { id: "a", firstReadAt: 100 },
    { id: "b", firstReadAt: 200 },
  ]);

  const relaunched = createReadContentStore(storage, () => 300);
  assert.deepEqual(await relaunched.read(), [
    { id: "a", firstReadAt: 100 },
    { id: "b", firstReadAt: 200 },
  ]);
});

void test("concurrent opens don't lose reads", async () => {
  let now = 0;
  const store = createReadContentStore(memoryStorage(), () => ++now);
  await Promise.all([
    store.markRead("a"),
    store.markRead("b"),
    store.markRead("a"),
  ]);
  assert.deepEqual(await store.read(), [
    { id: "a", firstReadAt: 1 },
    { id: "b", firstReadAt: 2 },
  ]);
});

void test("storage failures retain read history for the session", async () => {
  const store = createReadContentStore(
    {
      getItem: () => Promise.reject(new Error("unavailable")),
      setItem: () => Promise.reject(new Error("full")),
    },
    () => 10,
  );
  assert.deepEqual(await store.read(), []);
  await store.markRead("a");
  assert.deepEqual(await store.read(), [{ id: "a", firstReadAt: 10 }]);
});
