import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  collectRelationshipDocumentHashes,
  documentFreshnessHash,
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

void test("guide HTML freshness ignores the injected bot-protection script but not wording", () => {
  const page = (cb: string, words: string) =>
    Buffer.from(
      `<div id="mainCont"><p>${words}</p></div><script src="/_Incapsula_Resource?cb=${cb}"></script>`,
    );
  const url =
    "https://voterguide.sos.ca.gov/propositions/40/arguments-rebuttals.htm";
  assert.equal(
    documentFreshnessHash(url, page("1", "Vote yes.")),
    documentFreshnessHash(url, page("2", "Vote yes.")),
  );
  assert.notEqual(
    documentFreshnessHash(url, page("1", "Vote yes.")),
    documentFreshnessHash(url, page("1", "Vote no.")),
  );
});

void test("LAO historical report capture and freshness use the same bounded article text", async () => {
  const { capturePrecedentSource } = await import("./trillion-capture.js");
  const url = "https://lao.ca.gov/Publications/Report/4631";
  const words =
    "A historical report describes the enacted budget and distinguishes estimates from actual payments. ".repeat(
      7,
    );
  const page = (nav: string, text: string) =>
    Buffer.from(
      `<nav>${nav}</nav><div class="report-body"><h1>Report</h1><p>${text}</p><img alt="Spending categories by fiscal year"><script>transient()</script></div>`,
    );
  const original = page("old menu", words);
  const source = await capturePrecedentSource(
    "2",
    {
      id: "precedent-rebate-budget-2022",
      url,
      title: "LAO historical budget report",
      locator: "Taxpayer rebates",
    },
    async () => original,
  );
  assert.ok(source.snapshot.includes("Spending categories"));
  assert.ok(!source.snapshot.includes("transient"));
  assert.equal(
    source.documentHash,
    documentFreshnessHash(url, page("new menu", words)),
  );
  assert.notEqual(
    source.documentHash,
    documentFreshnessHash(url, page("new menu", words + "Corrected.")),
  );
  await assert.rejects(
    capturePrecedentSource(
      "2",
      {
        id: "precedent-empty",
        url,
        title: "Missing report",
        locator: "Report",
      },
      async () => Buffer.from("<html>Unavailable</html>"),
    ),
    /text missing/,
  );
});
