import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

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
