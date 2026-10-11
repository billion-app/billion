import assert from "node:assert/strict";
import test from "node:test";

import { fetchWithRetry } from "./fetch.js";

test("retries the nested Undici socket failure returned by Node fetch", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    if (calls === 1) {
      const cause = Object.assign(new Error("other side closed"), {
        code: "UND_ERR_SOCKET",
      });
      throw new TypeError("fetch failed", { cause });
    }
    return new Response("meeting data");
  });
  const response = await fetchWithRetry("https://legistar.test/events", {
    maxRetries: 1,
  });
  assert.equal(await response.text(), "meeting data");
  assert.equal(calls, 2);
});

test("nontransient fetch failures are not retried", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    throw new TypeError("Invalid request");
  });
  await assert.rejects(
    fetchWithRetry("https://invalid.test"),
    /Invalid request/,
  );
  assert.equal(calls, 1);
});

test("caller cancellation is retained and never retried", async (t) => {
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init: RequestInit) => {
      calls += 1;
      controller.abort();
      assert.equal(init.signal?.aborted, true);
      throw new DOMException("cancelled", "AbortError");
    },
  );
  await assert.rejects(
    fetchWithRetry("https://cancel.test", { signal: controller.signal }),
    /cancelled/,
  );
  assert.equal(calls, 1);
});
