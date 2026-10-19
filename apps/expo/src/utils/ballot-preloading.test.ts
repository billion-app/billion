import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

import type { IdleScheduler } from "./ballot-preloading";
import {
  BALLOT_STALE_TIME,
  ballotPreloads,
  canPreloadReader,
  createIdlePreloader,
} from "./ballot-preloading";

type IdleCallback = Parameters<IdleScheduler["request"]>[0];

function idleCallbacks() {
  let next = 0;
  const callbacks = new Map<number, IdleCallback>();
  return {
    request(callback: IdleCallback) {
      callbacks.set(++next, callback);
      return next;
    },
    cancel(handle: number) {
      callbacks.delete(handle);
    },
    run(timeRemaining = 10) {
      const entry = callbacks.entries().next().value;
      assert.ok(entry, "an idle callback is queued");
      callbacks.delete(entry[0]);
      entry[1]({ timeRemaining: () => timeRemaining });
    },
    get pending() {
      return callbacks.size;
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture(fetch: (number: string) => Promise<string | null>) {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  const idle = idleCallbacks();
  const options = (number: string) => ({
    queryKey: ["civic", "getTrillion", { number }],
    queryFn: () => fetch(number),
    staleTime: BALLOT_STALE_TIME,
  });
  const queue = createIdlePreloader<string>(
    (number) => client.prefetchQuery({ ...options(number), retry: false }),
    idle,
  );
  return {
    client,
    idle,
    options,
    queue,
    cleanup() {
      queue.dispose();
      client.clear();
    },
  };
}

test("starts only in idle time and yields again between sequential requests", async (t) => {
  const requests: string[] = [];
  const first = deferred<string>();
  const f = fixture((number) => {
    requests.push(number);
    return number === "1" ? first.promise : Promise.resolve(number);
  });
  t.after(() => f.cleanup());
  f.queue.setItems(["1", "2"]);
  assert.deepEqual(requests, []);
  f.idle.run(0);
  assert.deepEqual(requests, []);
  f.idle.run();
  assert.deepEqual(requests, ["1"]);
  assert.equal(f.idle.pending, 0);
  await setImmediate();
  assert.deepEqual(requests, ["1"]);
  first.resolve("first graph");
  await setImmediate();
  assert.deepEqual(requests, ["1"]);
  assert.equal(f.idle.pending, 1);
  f.idle.run();
  await setImmediate();
  assert.deepEqual(requests, ["1", "2"]);
  assert.equal(f.idle.pending, 0);
});

test("touch and scroll both have to finish before preloading resumes", async (t) => {
  const requests: string[] = [];
  const f = fixture((number) => {
    requests.push(number);
    return Promise.resolve(number);
  });
  t.after(() => f.cleanup());
  f.queue.setItems(["1"]);
  f.queue.setPaused("touch", true);
  f.queue.setPaused("scroll", true);
  assert.equal(f.idle.pending, 0);
  f.queue.setPaused("touch", false);
  assert.equal(f.idle.pending, 0);
  f.queue.setPaused("scroll", false);
  assert.deepEqual(requests, []);
  f.idle.run();
  await setImmediate();
  assert.deepEqual(requests, ["1"]);
});

test("inactive guides cancel queued work and resume from the same position", async (t) => {
  const requests: string[] = [];
  const f = fixture((number) => {
    requests.push(number);
    return Promise.resolve(number);
  });
  t.after(() => f.cleanup());
  f.queue.setItems(["1", "2"]);
  f.idle.run();
  await setImmediate();
  f.queue.setPaused("inactive", true);
  assert.equal(f.idle.pending, 0);
  f.queue.setPaused("inactive", false);
  f.idle.run();
  await setImmediate();
  assert.deepEqual(requests, ["1", "2"]);
});

test("blur keeps the active query available for navigation without continuing the queue", async (t) => {
  let requests = 0;
  const graph = deferred<string>();
  const f = fixture(() => {
    requests++;
    return graph.promise;
  });
  t.after(() => f.cleanup());
  f.queue.setItems(["1", "2"]);
  f.idle.run();
  f.queue.setPaused("inactive", true);
  const navigation = f.client.fetchQuery(f.options("1"));
  assert.equal(requests, 1);
  graph.resolve("ready");
  assert.equal(await navigation, "ready");
  await setImmediate();
  assert.equal(f.idle.pending, 0);
  f.queue.setPaused("inactive", false);
  assert.equal(requests, 1);
  f.idle.run();
  await setImmediate();
  assert.equal(requests, 2);
});

test("fresh graphs and null results are reused by both preload and foreground queries", async (t) => {
  const requests: string[] = [];
  const f = fixture((number) => {
    requests.push(number);
    return Promise.resolve(number === "2" ? null : "ready");
  });
  t.after(() => f.cleanup());
  f.client.setQueryData(f.options("1").queryKey, "cached");
  f.queue.setItems(["1", "2"]);
  f.idle.run();
  await setImmediate();
  assert.deepEqual(requests, []);
  f.idle.run();
  await setImmediate();
  assert.deepEqual(requests, ["2"]);
  assert.equal(await f.client.fetchQuery(f.options("1")), "cached");
  assert.equal(await f.client.fetchQuery(f.options("2")), null);
  assert.deepEqual(requests, ["2"]);
});

test("failed speculation has no retries, allows later measures, and can retry on navigation", async (t) => {
  const requests: string[] = [];
  let fail = true;
  const f = fixture((number) => {
    requests.push(number);
    if (number === "1" && fail) return Promise.reject(new Error("offline"));
    return Promise.resolve(number);
  });
  t.after(() => f.cleanup());
  f.queue.setItems(["1", "2"]);
  f.idle.run();
  await setImmediate();
  assert.deepEqual(requests, ["1"]);
  f.idle.run();
  await setImmediate();
  assert.deepEqual(requests, ["1", "2"]);
  fail = false;
  assert.equal(await f.client.fetchQuery(f.options("1")), "1");
  assert.deepEqual(requests, ["1", "2", "1"]);
});

test("unmount cancels queued callbacks and does not cancel a shared in-flight query", async (t) => {
  const first = deferred<string>();
  const requests: string[] = [];
  const f = fixture((number) => {
    requests.push(number);
    return first.promise;
  });
  t.after(() => f.cleanup());
  f.queue.setItems(["1", "2"]);
  f.idle.run();
  f.queue.dispose();
  first.resolve("ready");
  await setImmediate();
  assert.deepEqual(requests, ["1"]);
  assert.equal(f.client.getQueryData(f.options("1").queryKey), "ready");
  assert.equal(f.idle.pending, 0);
  f.queue.setPaused("inactive", false);
  f.queue.setItems(["3"]);
  assert.equal(f.idle.pending, 0);
});

test("a new guide does not overlap the request already in flight", async (t) => {
  const first = deferred<string>();
  const requests: string[] = [];
  const f = fixture((number) => {
    requests.push(number);
    return number === "1" ? first.promise : Promise.resolve(number);
  });
  t.after(() => f.cleanup());
  f.queue.setItems(["1", "2"]);
  f.idle.run();
  f.queue.setItems(["3"]);
  assert.equal(f.idle.pending, 0);
  first.resolve("ready");
  await setImmediate();
  f.idle.run();
  await setImmediate();
  assert.deepEqual(requests, ["1", "3"]);
});

test("runtimes without idle callbacks skip speculative requests", () => {
  let requests = 0;
  const queue = createIdlePreloader<string>(() => {
    requests++;
    return Promise.resolve();
  });
  queue.setItems(["1"]);
  assert.equal(requests, 0);
  queue.dispose();
});

test("opening a prepared screen keeps fresh data and refreshes expired data", async (t) => {
  let requests = 0;
  const f = fixture(() => Promise.resolve(`graph-${++requests}`));
  t.after(() => f.cleanup());
  await f.client.prefetchQuery(f.options("1"));
  const observer = new QueryObserver(f.client, {
    ...f.options("1"),
    enabled: false,
  });
  t.after(observer.subscribe(() => undefined));
  assert.equal(observer.getCurrentResult().data, "graph-1");
  observer.setOptions({ ...f.options("1"), enabled: true });
  await setImmediate();
  assert.equal(requests, 1, "opening fresh preparation reuses its data");
  observer.setOptions({ ...f.options("1"), enabled: false });
  f.client.setQueryData(f.options("1").queryKey, "graph-1", {
    updatedAt: Date.now() - BALLOT_STALE_TIME - 1,
  });
  observer.setOptions({ ...f.options("1"), enabled: true });
  assert.equal(observer.getCurrentResult().data, "graph-1");
  await setImmediate();
  assert.equal(observer.getCurrentResult().data, "graph-2");
  assert.equal(requests, 2);
});

test("opening a prepared screen recovers from failed background fetching", async (t) => {
  let online = false;
  let requests = 0;
  const f = fixture(() => {
    requests++;
    return online
      ? Promise.resolve("recovered")
      : Promise.reject(new Error("offline"));
  });
  t.after(() => f.cleanup());
  await f.client.prefetchQuery(f.options("1"));
  const observer = new QueryObserver(f.client, {
    ...f.options("1"),
    enabled: false,
  });
  t.after(observer.subscribe(() => undefined));
  await setImmediate();
  assert.equal(requests, 1, "hidden screens do not retry failed speculation");
  online = true;
  observer.setOptions({ ...f.options("1"), enabled: true });
  await setImmediate();
  assert.equal(observer.getCurrentResult().data, "recovered");
  assert.equal(requests, 2);
});

test("Feed prepares the full guide before the Elections screen", () => {
  assert.deepEqual(ballotPreloads(), [
    { kind: "guide" },
    { kind: "elections" },
  ]);
});

test("Measures warm every graph but prepare only the first two readers after their data", () => {
  assert.deepEqual(ballotPreloads(["1", "2", "3"]), [
    { kind: "guide" },
    { kind: "graph", number: "1" },
    { kind: "reader", number: "1" },
    { kind: "graph", number: "2" },
    { kind: "reader", number: "2" },
    { kind: "graph", number: "3" },
  ]);
});

test("reader preparation preserves mounted readers and never exceeds two hidden readers", () => {
  const reader = (number: string) => ({
    key: `reader-${number}`,
    name: "proposition-detail",
    params: { number },
  });
  assert.equal(
    canPreloadReader({ routes: [], preloadedRoutes: [] }, "1"),
    true,
  );
  assert.equal(
    canPreloadReader({ routes: [reader("1")], preloadedRoutes: [] }, "1"),
    false,
  );
  assert.equal(
    canPreloadReader({ routes: [], preloadedRoutes: [reader("1")] }, "1"),
    false,
  );
  assert.equal(
    canPreloadReader({ routes: [], preloadedRoutes: [reader("1")] }, "2"),
    true,
  );
  assert.equal(
    canPreloadReader(
      { routes: [], preloadedRoutes: [reader("1"), reader("2")] },
      "3",
    ),
    false,
  );
  assert.equal(
    canPreloadReader(
      { routes: [reader("1")], preloadedRoutes: [reader("2")] },
      "1",
    ),
    false,
  );
  assert.equal(
    canPreloadReader({ routes: [], preloadedRoutes: [reader("2")] }, "1"),
    true,
  );
});
