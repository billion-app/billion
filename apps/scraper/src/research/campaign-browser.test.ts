import assert from "node:assert/strict";
import test from "node:test";

import type { ResearchSource } from "@acme/validators";
import { campaignArchiveHash } from "@acme/api/lib/campaign-render-archive";
import { formatCampaignHtml } from "@acme/api/lib/campaign-source-html";

import {
  admittedCampaignShell,
  CampaignRendererUnavailable,
  renderCampaignSource,
} from "./campaign-browser";

function shell(
  html = '<html><head><script type="module" src="/app.js"></script></head><body><div id="root"></div></body></html>',
): ResearchSource {
  const url = "https://campaign.example/",
    bytes = Buffer.from(html),
    hash = campaignArchiveHash(bytes),
    text = formatCampaignHtml(html, url).text,
    time = "2026-01-01T00:00:00.000Z";
  return {
    id: "root",
    url,
    retrievalUrls: [url],
    publisher: "offline fixture",
    format: "html",
    text,
    contentHash: campaignArchiveHash(text),
    byteHash: hash,
    binaryBase64: bytes.toString("base64"),
    fetchedAt: time,
    httpObservation: {
      kind: "campaign_http_document_v1",
      responses: [
        {
          url,
          status: 200,
          mime: "text/html",
          location: null,
          bodyHash: hash,
          bodyBytes: bytes.length,
          startedAt: time,
          completedAt: time,
        },
      ],
    },
  };
}
test("only actual successful empty same-origin module shells admit rendering", () => {
  assert.equal(admittedCampaignShell(shell()), true);
  for (const html of [
    '<main>Substantive ordinary static campaign text is already available.</main><script type="module" src="/app.js"></script>',
    '<script type="module" src="https://outside.example/app.js"></script>',
    '<script type="module" src="/app.js"></script><p>captcha</p>',
    '<script type="module" src="/app.js"></script><meta name="robots" content="none">',
    '<script src="/app.js"></script>',
  ])
    assert.equal(admittedCampaignShell(shell(html)), false);
  for (const status of [403, 429, 503]) {
    const value = shell();
    value.httpObservation!.responses[0]!.status = status;
    assert.equal(admittedCampaignShell(value), false);
  }
  const changed = shell();
  changed.binaryBase64 = Buffer.from("different bytes").toString("base64");
  assert.equal(admittedCampaignShell(changed), false);
});
test("unsupported or missing isolated capability fails closed before any public request", async () => {
  let network = 0;
  const input = {
    initial: shell(),
    candidateId: "example",
    ownershipDigest: "a".repeat(64),
    budget: {
      request() {
        network++;
      },
      bytes() {
        network++;
      },
    },
  };
  await assert.rejects(
    renderCampaignSource(input),
    CampaignRendererUnavailable,
  );
  await assert.rejects(
    renderCampaignSource({
      ...input,
      configuration: {
        baseUrl: "http://attacker.example",
        token: "a".repeat(32),
      },
    }),
    CampaignRendererUnavailable,
  );
  assert.equal(network, 0);
});
