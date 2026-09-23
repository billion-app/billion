import assert from "node:assert/strict";
import test from "node:test";

import {
  createLocalReaderState,
  JURISDICTION_KEY,
  MAX_SAVED,
  SAVED_KEY,
} from "./reader-state";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const bill = { type: "bill", title: "A bill" };

void test("a save goes to the front; saving again moves it, never doubles", async () => {
  const state = createLocalReaderState(memoryStorage());
  await state.save("a", bill);
  await state.save("b", bill);
  assert.deepEqual(await state.savedIds(), ["b", "a"]);
  await state.save("a", bill);
  assert.deepEqual(await state.savedIds(), ["a", "b"]);
});

void test("unsave removes and persists", async () => {
  const storage = memoryStorage();
  const state = createLocalReaderState(storage);
  await state.save("a", bill);
  await state.save("b", bill);
  await state.unsave("a");
  assert.deepEqual(await state.savedIds(), ["b"]);
  const reread = createLocalReaderState(storage);
  assert.deepEqual(await reread.savedIds(), ["b"]);
});

void test("an unreadable list reads as nothing saved", async () => {
  for (const raw of ["{nope", "42", '["a", 3]', '{"entries":"x"}']) {
    const state = createLocalReaderState(memoryStorage({ [SAVED_KEY]: raw }));
    assert.deepEqual(await state.savedIds(), [], raw);
  }
});

void test("the list is bounded", async () => {
  const state = createLocalReaderState(memoryStorage());
  for (let i = 0; i < MAX_SAVED + 5; i++) await state.save(`id${i}`, bill);
  const ids = await state.savedIds();
  assert.equal(ids.length, MAX_SAVED);
  assert.equal(ids[0], `id${MAX_SAVED + 4}`);
});

void test("quick saves do not overwrite one another", async () => {
  const state = createLocalReaderState(memoryStorage());
  await Promise.all([state.save("a", bill), state.save("b", bill)]);
  assert.deepEqual((await state.savedIds()).sort(), ["a", "b"]);
});

void test("jurisdiction defaults to federal and ignores unsupported values", async () => {
  assert.equal(
    await createLocalReaderState(memoryStorage()).jurisdiction(),
    "federal",
  );
  assert.equal(
    await createLocalReaderState(
      memoryStorage({ [JURISDICTION_KEY]: "mo" }),
    ).jurisdiction(),
    "federal",
  );
  const state = createLocalReaderState(memoryStorage());
  await state.setJurisdiction("tx");
  assert.equal(await state.jurisdiction(), "tx");
});

void test("a storage that throws keeps the value for this session", async () => {
  const state = createLocalReaderState({
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("quota");
    },
  });
  await state.save("a", bill);
  assert.deepEqual(await state.savedIds(), ["a"]);
  await state.setJurisdiction("ca");
  assert.equal(await state.jurisdiction(), "ca");
});

void test("no storage at all still works in memory", async () => {
  const state = createLocalReaderState(null);
  await state.save("a", bill);
  assert.deepEqual(await state.savedIds(), ["a"]);
});

void test("subscribers hear about changes", async () => {
  const state = createLocalReaderState(memoryStorage());
  let calls = 0;
  const off = state.subscribe(() => calls++);
  await state.save("a", bill);
  await state.setJurisdiction("ca");
  off();
  await state.unsave("a");
  assert.equal(calls, 2);
});
