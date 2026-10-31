import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import test from "node:test";
import type { LookupFunction } from "node:net";

import { requestPublicSource } from "./transport.js";

test("source transport uses the pinned address without resolving the source hostname again", async (t) => {
  const server = createServer((request, response) => {
    response.end(request.headers.host);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://nonexistent-source.invalid:${address.port}/`;
  const response = await requestPublicSource(
    url,
    [{ address: "127.0.0.1", family: 4 }],
    AbortSignal.timeout(3000),
  );
  assert.equal(
    await response.text(),
    `nonexistent-source.invalid:${address.port}`,
  );
});

for (const scenario of [
  {
    options: { all: true },
    expected: [
      null,
      [
        { address: "2600:1406:3a00:c::17d8:9545", family: 6 },
        { address: "203.0.113.10", family: 4 },
      ],
    ],
  },
  { options: { family: 4 }, expected: [null, "203.0.113.10", 4] },
  { options: {}, expected: [null, "2600:1406:3a00:c::17d8:9545", 6] },
]) {
  test(`failed pinned lookup reaches installed request error handling ${JSON.stringify(scenario.options)}`, async (t) => {
    const original = https.request;
    const connectionError = Object.assign(
      new Error("All pinned addresses are unreachable"),
      {
        code: "ENETUNREACH",
      },
    );
    const lookupTimingError = new Error(
      "Pinned lookup completed before request error handling was installed",
    );
    let selected: unknown[] | undefined;
    let ended = false;
    Object.defineProperty(https, "request", {
      configurable: true,
      writable: true,
      value: (_url: string, options: { lookup: LookupFunction }) => {
        const request = Object.assign(new EventEmitter(), {
          end() {
            ended = true;
          },
        });
        options.lookup(
          "source.invalid",
          scenario.options,
          (...values: unknown[]) => {
            selected = values;
            request.emit(
              "error",
              request.listenerCount("error")
                ? connectionError
                : lookupTimingError,
            );
          },
        );
        return request;
      },
    });
    syncBuiltinESMExports();
    t.after(() => {
      https.request = original;
      syncBuiltinESMExports();
    });
    await assert.rejects(
      requestPublicSource(
        "https://source.invalid/",
        [
          { address: "2600:1406:3a00:c::17d8:9545", family: 6 },
          { address: "203.0.113.10", family: 4 },
        ],
        AbortSignal.timeout(3000),
      ),
      (error: unknown) => error === connectionError,
    );
    assert.equal(ended, true);
    assert.deepEqual(selected, scenario.expected);
  });
}
