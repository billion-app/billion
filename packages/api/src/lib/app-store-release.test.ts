import assert from "node:assert/strict";
import test from "node:test";

import { fetchAppStoreRelease, getAppStoreRelease } from "./app-store-release";

const app = {
  trackId: 6761675243,
  bundleId: "app.billion-news.billion",
  version: "1.2.3",
  minimumOsVersion: "16.4",
};

void test("looks up the public Billion listing and returns a fixed store destination", async () => {
  const release = await fetchAppStoreRelease((url, options) => {
    assert.equal(
      url,
      "https://itunes.apple.com/lookup?id=6761675243&country=us",
    );
    assert.ok(options?.signal);
    return Promise.resolve(
      Response.json({
        results: [{ ...app, trackViewUrl: "https://untrusted.example" }],
      }),
    );
  });
  assert.deepEqual(release, {
    version: "1.2.3",
    minimumOsVersion: "16.4",
    url: "https://apps.apple.com/us/app/billion-news/id6761675243",
  });
});

void test("missing, malformed and unrelated listings never advertise an update", async () => {
  for (const body of [
    { results: [] },
    {},
    { results: [{ ...app, trackId: 1 }] },
    { results: [{ ...app, bundleId: "another.app" }] },
    { results: [{ ...app, version: "1.beta" }] },
    { results: [{ ...app, minimumOsVersion: null }] },
  ]) {
    assert.equal(
      await fetchAppStoreRelease(() => Promise.resolve(Response.json(body))),
      null,
    );
  }
});

void test("HTTP failures, invalid JSON and timeouts fail quietly", async () => {
  assert.equal(
    await fetchAppStoreRelease(() =>
      Promise.resolve(new Response("offline", { status: 503 })),
    ),
    null,
  );
  assert.equal(
    await fetchAppStoreRelease(() => Promise.resolve(new Response("not JSON"))),
    null,
  );
  assert.equal(
    await fetchAppStoreRelease(() => Promise.reject(new Error("timeout"))),
    null,
  );
});

void test("concurrent requests share a lookup, success caches for an hour, failure for five minutes", async (t) => {
  let now = Date.now();
  let fail = false;
  const fetchMock = t.mock.method(globalThis, "fetch", () =>
    Promise.resolve(
      fail
        ? new Response("unavailable", { status: 503 })
        : Response.json({ results: [app] }),
    ),
  );
  t.mock.method(Date, "now", () => now);
  const [first, second] = await Promise.all([
    getAppStoreRelease(),
    getAppStoreRelease(),
  ]);
  assert.deepEqual(first, second);
  assert.equal(fetchMock.mock.callCount(), 1);
  now += 59 * 60 * 1000;
  await getAppStoreRelease();
  assert.equal(fetchMock.mock.callCount(), 1);
  now += 60 * 1000;
  fail = true;
  assert.equal(await getAppStoreRelease(), null);
  assert.equal(fetchMock.mock.callCount(), 2);
  now += 4 * 60 * 1000;
  await getAppStoreRelease();
  assert.equal(fetchMock.mock.callCount(), 2);
  now += 60 * 1000;
  fail = false;
  assert.ok(await getAppStoreRelease());
  assert.equal(fetchMock.mock.callCount(), 3);
});
