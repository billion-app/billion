import assert from "node:assert/strict";
import { test } from "node:test";

import type { Preparation } from "./preparation";
import {
  contestSnapshot,
  createPreparationStore,
  electionKey,
  parsePreparation,
} from "./preparation";

const entry: Preparation = {
  election: "e1",
  snapshot: "c1",
  title: "Council",
  electionName: "General",
  electionDay: "2026-11-03",
  notes: "Private",
  progress: "undecided",
  choice: "A",
};
test("persists, restores and serializes concurrent saves; deletion survives reopening", async () => {
  let disk: string | null = null;
  const storage = {
    getItem: async () => {
      await Promise.resolve();
      return disk;
    },
    setItem: async (_key: string, value: string) => {
      await Promise.resolve();
      disk = value;
    },
  };
  const store = createPreparationStore(storage);
  await Promise.all([
    store.save(entry),
    store.save({ ...entry, snapshot: "c2", progress: "reviewed" }),
  ]);
  assert.equal((await createPreparationStore(storage).read()).length, 2);
  await store.remove(entry);
  assert.equal((await store.read())[0]?.progress, "reviewed");
  await store.clear();
  assert.deepEqual(await createPreparationStore(storage).read(), []);
});
test("storage failures reject without claiming success and later writes recover", async () => {
  let fail = true;
  let disk: string | null = null;
  const store = createPreparationStore({
    getItem: async () => {
      await Promise.resolve();
      return disk;
    },
    setItem: async (_k, v) => {
      await Promise.resolve();
      if (fail) throw Error("disk");
      disk = v;
    },
  });
  await assert.rejects(store.save(entry));
  fail = false;
  assert.deepEqual(await store.save(entry), [entry]);
});
test("malformed and oversized notes are not silently erased", () => {
  assert.throws(() => parsePreparation("broken"));
  assert.throws(() =>
    parsePreparation(JSON.stringify([{ ...entry, notes: "x".repeat(1001) }])),
  );
});
test("election/provider/date and roster/withdrawal changes do not reuse identity", () => {
  const election = {
    id: "1",
    name: "General",
    electionDay: "2026-11-03",
    ocdDivisionId: "us",
  };
  assert.notEqual(electionKey(election, "one"), electionKey(election, "two"));
  assert.notEqual(
    electionKey(election, "one"),
    electionKey({ ...election, electionDay: "2028-11-07" }, "one"),
  );
  const contest = {
    type: "General",
    office: "Council",
    candidates: [{ name: "A" }, { name: "B" }],
  };
  assert.equal(
    contestSnapshot(contest),
    contestSnapshot({
      ...contest,
      candidates: [...contest.candidates].reverse(),
    }),
  );
  assert.notEqual(
    contestSnapshot(contest),
    contestSnapshot({
      ...contest,
      candidates: [
        { name: "A", ballotStatus: "withdrewStillOnBallot" },
        { name: "B" },
      ],
    }),
  );
  assert.notEqual(
    contestSnapshot(contest),
    contestSnapshot({ ...contest, office: "Mayor" }),
  );
});

test("all ballot rules invalidate a saved snapshot", () => {
  const contest = { type: "General", office: "Council" };
  for (const change of [
    { numberElected: "2" },
    { special: "yes" },
    { ballotTitle: "Seat 3" },
    { electorateSpecifications: "Party voters only" },
  ])
    assert.notEqual(
      contestSnapshot(contest),
      contestSnapshot({ ...contest, ...change }),
    );
});

test("explicit deletion recovers malformed storage", async () => {
  let disk = "broken";
  const store = createPreparationStore({
    getItem: () => Promise.resolve(disk),
    setItem: (_key, value) => {
      disk = value;
      return Promise.resolve();
    },
  });
  await assert.rejects(store.read());
  await store.clear();
  assert.deepEqual(await store.read(), []);
});
