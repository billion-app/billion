import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  collectRelationshipDocumentHashes,
  fetchRelationshipDocument,
} from "./measure-relationship-source.js";

void test("source cap stops the stream and cancels before reading the rest", async () => {
  const original = globalThis.fetch;
  let cancelled = false;
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new Uint8Array(1000000));
        },
        cancel() {
          cancelled = true;
        },
      }),
    );
  try {
    await assert.rejects(
      fetchRelationshipDocument("https://vig.cdn.sos.ca.gov/document.pdf"),
      /5 MB/,
    );
    assert.ok(cancelled);
  } finally {
    globalThis.fetch = original;
  }
});
void test("source host restrictions run before any network request; pending revisions do not fetch", async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response("source");
  };
  try {
    await assert.rejects(
      fetchRelationshipDocument("https://example.com/document"),
      /host/,
    );
    assert.deepEqual(await collectRelationshipDocumentHashes("2026-11-03"), []);
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = original;
  }
});
void test("document refresh hashes original bytes without substituting extracted text", async () => {
  const original = globalThis.fetch;
  const bytes = new TextEncoder().encode("original document bytes");
  globalThis.fetch = async () => new Response(bytes);
  try {
    assert.equal(
      createHash("sha256")
        .update(
          await fetchRelationshipDocument(
            "https://vig.cdn.sos.ca.gov/document.pdf",
          ),
        )
        .digest("hex"),
      createHash("sha256").update(bytes).digest("hex"),
    );
  } finally {
    globalThis.fetch = original;
  }
});
