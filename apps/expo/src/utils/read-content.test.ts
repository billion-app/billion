import assert from "node:assert/strict";
import test from "node:test";

import {
  createReadContentStore,
  parseReadIds,
  READ_CONTENT_KEY,
  unreadArticles,
} from "./read-content";

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: (key: string) => {
      assert.equal(key, READ_CONTENT_KEY);
      return Promise.resolve(value);
    },
    setItem: async (key: string, next: string) => {
      assert.equal(key, READ_CONTENT_KEY);
      await Promise.resolve();
      value = next;
    },
  };
}

void test("missing or corrupt history doesn't stop the feed", () => {
  for (const raw of [null, "", "broken", "{}", '[1,"a"]']) {
    assert.deepEqual(parseReadIds(raw), []);
  }
  assert.deepEqual(parseReadIds('["a","a","b"]'), ["a", "b"]);
});

void test("unread articles retain editorial order and don't duplicate", () => {
  const articles = [{ id: "a" }, { id: "b" }, { id: "a" }, { id: "c" }];
  assert.deepEqual(unreadArticles(articles, []), [
    { id: "a" },
    { id: "b" },
    { id: "c" },
  ]);
  assert.deepEqual(unreadArticles(articles, ["a", "unknown"]), [
    { id: "b" },
    { id: "c" },
  ]);
});

void test("reading the selection empties it, and a newly featured article reappears", async () => {
  const storage = memoryStorage();
  const store = createReadContentStore(storage);
  const articles = [{ id: "a" }, { id: "b" }];
  assert.equal(unreadArticles(articles, await store.read()).length, 2);
  await store.markRead("a");
  assert.deepEqual(unreadArticles(articles, await store.read()), [{ id: "b" }]);
  await store.markRead("b");
  assert.deepEqual(unreadArticles(articles, await store.read()), []);
  // Relaunch reads the persisted history, not just the old in-memory value.
  const relaunched = createReadContentStore(storage);
  assert.deepEqual(unreadArticles(articles, await relaunched.read()), []);
  assert.deepEqual(
    unreadArticles([...articles, { id: "new" }], await relaunched.read()),
    [{ id: "new" }],
  );
});

void test("concurrent opens and repeat visits don't lose reads", async () => {
  const storage = memoryStorage();
  const store = createReadContentStore(storage);
  await Promise.all([
    store.markRead("a"),
    store.markRead("b"),
    store.markRead("a"),
  ]);
  assert.deepEqual(await createReadContentStore(storage).read(), ["a", "b"]);
});

void test("storage failures retain read history for the session", async () => {
  const store = createReadContentStore({
    getItem: () => Promise.reject(new Error("unavailable")),
    setItem: () => Promise.reject(new Error("full")),
  });
  assert.deepEqual(await store.read(), []);
  await store.markRead("a");
  await store.markRead("b");
  assert.deepEqual(await store.read(), ["a", "b"]);
});
