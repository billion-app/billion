import assert from "node:assert/strict";
import test from "node:test";

import { loadShareArt } from "./share-art";

const record = {
  id: "a1b2c3d4-1111-2222-3333-444455556666",
  type: "government_content",
  title: "An executive action",
  description: "What it does.",
};

void test("remote artwork follows validated CDN redirects", async () => {
  const visited: string[] = [];
  const art = await loadShareArt(
    { ...record, thumbnailUrl: "https://images.example/original" },
    (url) => {
      visited.push(url.toString());
      return Promise.resolve(
        visited.length === 1
          ? new Response(null, {
              status: 302,
              headers: { location: "https://cdn.example/rendered.png" },
            })
          : new Response(new Uint8Array([137, 80, 78, 71]), {
              headers: { "content-type": "image/png" },
            }),
      );
    },
  );

  assert.deepEqual(visited, [
    "https://images.example/original",
    "https://cdn.example/rendered.png",
  ]);
  assert.equal(art, "data:image/png;base64,iVBORw==");
});

void test("a redirect to a private host is refused", async () => {
  let requests = 0;
  const art = await loadShareArt(
    { ...record, thumbnailUrl: "https://images.example/original" },
    () => {
      requests += 1;
      return Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/internal.png" },
        }),
      );
    },
  );

  assert.equal(requests, 1);
  assert.equal(art, undefined);
});

void test("an oversized response is omitted without reading its body", async () => {
  const art = await loadShareArt(
    { ...record, thumbnailUrl: "https://images.example/huge.png" },
    () =>
      Promise.resolve(
        new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: {
            "content-length": String(6 * 1024 * 1024),
            "content-type": "image/png",
          },
        }),
      ),
  );

  assert.equal(art, undefined);
});
