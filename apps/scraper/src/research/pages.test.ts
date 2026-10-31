import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalSourceUrl,
  retrieveSource,
  validatePublicSource,
} from "./pages.js";

test("source URLs preserve meaningful query parameters while removing tracking", () => {
  assert.equal(
    canonicalSourceUrl("https://example.gov/report?id=12&utm_source=test#page"),
    "https://example.gov/report?id=12",
  );
  assert.throws(() =>
    canonicalSourceUrl("https://secret:password@example.gov"),
  );
});

test("private and mapped loopback addresses are rejected", async () => {
  for (const host of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "[::1]",
    "[::ffff:127.0.0.1]",
  ]) {
    await assert.rejects(
      validatePublicSource(`http://${host}/`),
      /Private source/,
    );
  }
});

test("readable source extraction removes navigation and retains source text", async () => {
  const transport = async () =>
    new Response(
      `<html><title>Analysis</title><nav>Unrelated navigation</nav><main>${"Documented policy precedent. ".repeat(10)}</main><script>instructions</script></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  const document = await retrieveSource(
    "https://93.184.216.34/report",
    transport,
  );
  assert.equal(document.title, "Analysis");
  assert.doesNotMatch(document.body, /navigation|instructions/);
  assert.match(document.body, /Documented policy/);
});

test("whitespace-only main falls back to readable body text", async () => {
  const body = "Documented candidate record and source evidence. "
    .repeat(4)
    .trim();
  const document = await retrieveSource(
    "https://93.184.216.34/report",
    async () =>
      new Response(
        `<body><nav>menu</nav><main> \n\t </main><p>${body}</p><script>bad</script><footer>footer</footer></body>`,
        { headers: { "Content-Type": "text/html" } },
      ),
  );
  assert.equal(document.body, body);
});

test("heading-only main falls back to readable body text", async () => {
  const body = "Documented candidate record and source evidence. "
    .repeat(4)
    .trim();
  const document = await retrieveSource(
    "https://93.184.216.34/report",
    async () =>
      new Response(`<body><p>${body}</p><main><h1>Home</h1></main></body>`, {
        headers: { "Content-Type": "text/html" },
      }),
  );
  assert.equal(document.body, `${body}Home`);
});

test("whitespace-only main falls back to article before other body text", async () => {
  const article = "Documented policy precedent and attributable evidence. "
    .repeat(4)
    .trim();
  const document = await retrieveSource(
    "https://93.184.216.34/report",
    async () =>
      new Response(
        `<body><main> \n\t </main><article>${article}</article><p>Unrelated body text</p></body>`,
        { headers: { "Content-Type": "text/html" } },
      ),
  );
  assert.equal(document.body, article);
});

test("meaningful main takes priority over article and other body text", async () => {
  const main = "Documented candidate record and source evidence. "
    .repeat(4)
    .trim();
  const document = await retrieveSource(
    "https://93.184.216.34/report",
    async () =>
      new Response(
        `<body><main>${main}</main><article>Other article</article><p>Unrelated body text</p></body>`,
        { headers: { "Content-Type": "text/html" } },
      ),
  );
  assert.equal(document.body, main);
});

test("redirects cannot reach private services", async () => {
  let requests = 0;
  const transport = async () => {
    requests++;
    return new Response(null, {
      status: 302,
      headers: { Location: "http://127.0.0.1/secret" },
    });
  };
  await assert.rejects(
    retrieveSource("https://93.184.216.34/report", transport),
    /Private source/,
  );
  assert.equal(requests, 1);
});
