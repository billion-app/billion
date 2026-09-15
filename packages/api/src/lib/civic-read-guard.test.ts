import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import {
  CivicReadUnavailableError,
  createCivicReadGuard,
} from "./civic-read-guard";

for (const failing of [false, true]) {
  void test(`bounded cold burst, provider failure=${failing}`, async () => {
    const read = createCivicReadGuard({ timeoutMs: 200, maxActive: 8 });
    let upstream = 0;
    const latencies: number[] = [];
    const results = await Promise.allSettled(
      Array.from({ length: 100 }, async () => {
        const start = performance.now();
        try {
          return await read("same-address-and-election", async () => {
            upstream++;
            await delay(20);
            if (failing) throw new Error("fake provider unavailable");
            return { pollingLocations: [], source: "fake" };
          });
        } finally {
          latencies.push(performance.now() - start);
        }
      }),
    );
    const errors = results.filter((r) => r.status === "rejected").length;
    latencies.sort((a, b) => a - b);
    console.log(
      JSON.stringify({
        requests: 100,
        failing,
        upstream,
        errors,
        p95Ms: latencies[94],
      }),
    );
    assert.equal(upstream, 1);
    assert.equal(errors, failing ? 100 : 0);
    assert.ok((latencies[94] ?? Infinity) < 200);
    assert.equal(
      await read("same-address-and-election", () => Promise.resolve("retry")),
      "retry",
    );
  });
}

void test("timeout retains admission until work settles; overload never starts work", async () => {
  const read = createCivicReadGuard({ timeoutMs: 10, maxActive: 1 });
  let finish!: (value: string) => void;
  const first = read(
    "a",
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  assert.equal(
    read("a", () => Promise.resolve("duplicate")),
    first,
  );
  await assert.rejects(first, CivicReadUnavailableError);
  await assert.rejects(
    read("b", () => {
      throw new Error("must not execute");
    }),
    CivicReadUnavailableError,
  );
  await assert.rejects(
    read("a", () => Promise.resolve("duplicate")),
    CivicReadUnavailableError,
  );
  finish("late");
  await delay(0);
  assert.equal(
    await read("b", () => Promise.resolve("recovered")),
    "recovered",
  );
});

void test("distinct election/address keys remain isolated and sync throws release admission", async () => {
  const read = createCivicReadGuard();
  assert.deepEqual(
    await Promise.all([
      read("a:1", () => Promise.resolve(1)),
      read("a:2", () => Promise.resolve(2)),
    ]),
    [1, 2],
  );
  await assert.rejects(
    read("a", () => {
      throw new Error("failure");
    }),
  );
  assert.equal(await read("a", () => Promise.resolve(3)), 3);
});
