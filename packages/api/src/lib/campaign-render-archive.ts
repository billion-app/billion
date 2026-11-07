import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { gunzipSync, gzipSync } from "node:zlib";
import { load } from "cheerio";
import { z } from "zod/v4";

import type { ResearchSource } from "@acme/validators";

import { formatCampaignHtml } from "./campaign-source-html";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const time = z.iso.datetime();
export const campaignRenderArchiveSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal("network_none_campaign_archive"),
    candidateId: z.string().min(1).max(200),
    ownershipDigest: digest,
    origin: z.url(),
    requestedUrl: z.url(),
    renderer: z
      .object({
        protocol: z.literal("campaign-browser-network-none-v1"),
        image: z.literal(
          "mcr.microsoft.com/playwright@sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d",
        ),
        playwrightVersion: z.literal("1.58.2"),
        browserVersion: z.string().min(1).max(100),
        seccompHash: z.literal(
          "428a062dfcc138999687d9922b61a8bc5cf0bce198198e4cf45c5e9b0289cb52",
        ),
        sandbox: z.string().min(1).max(4000),
      })
      .strict(),
    initialResponseCount: z.number().int().min(1).max(4),
    responses: z
      .array(
        z
          .object({
            url: z.url(),
            status: z.number().int().min(200).max(399),
            mime: z.string().max(200),
            location: z.string().max(4000).nullable(),
            kind: z.enum(["document", "script", "stylesheet"]),
            bodyHash: digest,
            bodyBytes: z.number().int().min(0).max(10_000_000),
            startedAt: time,
            completedAt: time,
          })
          .strict(),
      )
      .min(1)
      .max(30),
    bodies: z.record(digest, z.string().max(13_333_336)),
    pages: z
      .array(
        z
          .object({
            url: z.url(),
            initialBodyHash: digest,
            domHtml: z.string().min(20).max(1_000_000),
            evidenceDomHtml: z.string().min(20).max(1_000_000),
            visibleText: z.string().min(100).max(500_000),
            capturedAt: time,
            mainObservations: z
              .array(
                z
                  .object({
                    text: z.string().max(100_000),
                    scrollY: z.number().min(0).max(50_000),
                    capturedAt: time,
                  })
                  .strict(),
              )
              .min(1)
              .max(90),
          })
          .strict(),
      )
      .min(1)
      .max(3),
    blocked: z
      .array(
        z
          .object({ url: z.string().max(4000), reason: z.string().max(100) })
          .strict(),
      )
      .max(1000),
  })
  .strict();
export type CampaignRenderArchive = z.infer<typeof campaignRenderArchiveSchema>;
export const campaignArchiveHash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const normalized = (value: string) =>
  value.replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
const host = (value: string) => new URL(value).hostname.replace(/^www\./, "");

export function formatRenderedCampaignHtml(html: string, url: string) {
  const $ = load(html);
  $("br").replaceWith(" ");
  return formatCampaignHtml($.html(), url);
}

export function campaignMainContextCovered(
  html: string,
  observations: string[],
) {
  const $ = load(html);
  $("script,style,nav,footer,noscript").remove();
  $("br").replaceWith(" ");
  const normalize = (text: string) =>
    text.replace(/\s+/g, "").toLocaleLowerCase("en-US");
  const observed = observations.map(normalize);
  const nodes: string[] = [];
  const visit = (selection: ReturnType<typeof $>) =>
    selection.contents().each((_, node) => {
      if (node.nodeType === 3) {
        const text = normalize(node.data);
        if (text) nodes.push(text);
      } else visit($(node));
    });
  visit($("main"));
  const words = (text: string) =>
    text.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu) ?? [];
  const retainedWords = words($("main").text());
  const observationRetained = (frame: string) => {
    let cursor = 0;
    for (const word of words(frame)) {
      while (cursor < retainedWords.length && retainedWords[cursor] !== word)
        cursor++;
      if (cursor === retainedWords.length) return false;
      cursor++;
    }
    return true;
  };
  return (
    nodes.length > 0 &&
    nodes.every((text) => observed.some((frame) => frame.includes(text))) &&
    observations.every(observationRetained)
  );
}

export function validateCampaignRenderArchive(
  value: unknown,
  now = Date.now(),
) {
  const archive = campaignRenderArchiveSchema.parse(value);
  const origin = new URL(archive.origin);
  if (
    isIP(origin.hostname.replace(/^\[|\]$/g, "")) ||
    !origin.hostname.includes(".") ||
    /\.(?:local|internal|localhost)$/i.test(origin.hostname)
  )
    throw new Error("Campaign archive requires a public domain");
  if (
    origin.protocol !== "https:" ||
    origin.origin !== archive.origin ||
    origin.username ||
    origin.password ||
    origin.port ||
    host(archive.requestedUrl) !== host(archive.origin)
  )
    throw new Error(
      "Campaign archive origin is not the bound public HTTPS origin",
    );
  if (
    !/Layer 1 Sandbox\s+Namespace/.test(archive.renderer.sandbox) ||
    ["PID namespaces", "Network namespaces", "Seccomp-BPF sandbox"].some(
      (label) => !new RegExp(label + "\\s+Yes").test(archive.renderer.sandbox),
    )
  )
    throw new Error("Campaign archive lacks its actual sandbox capability");
  let total = 0;
  let earliest = Infinity;
  const hashes = new Set<string>();
  for (const [index, response] of archive.responses.entries()) {
    const url = new URL(response.url);
    if (
      url.username ||
      url.password ||
      url.port ||
      (index >= archive.initialResponseCount
        ? url.origin !== archive.origin
        : host(response.url) !== host(archive.origin))
    )
      throw new Error("Campaign archive response escaped its approved origin");
    if (
      url.protocol !== "https:" &&
      !(
        index === 0 &&
        response.url === archive.requestedUrl &&
        url.protocol === "http:"
      )
    )
      throw new Error("Campaign archive response used an unsupported protocol");
    const started = Date.parse(response.startedAt),
      completed = Date.parse(response.completedAt);
    if (started > completed || completed > now || !Number.isFinite(started))
      throw new Error("Campaign archive has invalid acquisition clocks");
    earliest = Math.min(earliest, started);
    const encoded = archive.bodies[response.bodyHash];
    if (encoded === undefined)
      throw new Error("Campaign archive references missing raw bytes");
    const body = Buffer.from(encoded, "base64");
    if (
      body.toString("base64") !== encoded ||
      body.length !== response.bodyBytes ||
      campaignArchiveHash(body) !== response.bodyHash
    )
      throw new Error("Campaign archive raw-byte binding failed");
    hashes.add(response.bodyHash);
    total += body.length;
    if (total > 10_000_000)
      throw new Error("Campaign archive exceeds received-body byte bound");
    if (response.status >= 300) {
      if (
        ![301, 302, 303, 307, 308].includes(response.status) ||
        !response.location ||
        !archive.responses
          .slice(index + 1)
          .some(
            (next) =>
              next.url === new URL(response.location ?? "", response.url).href,
          )
      )
        throw new Error("Campaign archive redirect chain is incomplete");
    } else if (response.status !== 200)
      throw new Error(
        "Campaign archive contains an incomplete required response",
      );
    if (
      response.status === 200 &&
      !(
        response.kind === "document"
          ? /text\/html/i
          : response.kind === "script"
            ? /(?:java|ecma)script/i
            : /text\/css/i
      ).test(response.mime)
    )
      throw new Error(
        "Campaign archive response MIME is not executable by its declared role",
      );
  }
  if (hashes.size !== Object.keys(archive.bodies).length)
    throw new Error("Campaign archive contains unreferenced raw bytes");
  const urls = new Set<string>();
  for (const page of archive.pages) {
    if (new URL(page.url).origin !== archive.origin || urls.has(page.url))
      throw new Error("Campaign render page is not a unique approved document");
    urls.add(page.url);
    const document = archive.responses.find(
      (row) =>
        row.url === page.url &&
        row.status === 200 &&
        row.kind === "document" &&
        row.bodyHash === page.initialBodyHash,
    );
    if (
      !document ||
      Date.parse(page.capturedAt) < Date.parse(document.completedAt) ||
      Date.parse(page.capturedAt) > now
    )
      throw new Error(
        "Campaign DOM is not bound to its actual document and clock",
      );
    const extracted = formatRenderedCampaignHtml(
      page.evidenceDomHtml,
      page.url,
    );
    if (
      extracted.substantive.length < 180 ||
      !campaignMainContextCovered(
        page.evidenceDomHtml,
        page.mainObservations.map((observation) => observation.text),
      ) ||
      page.mainObservations.some(
        (observation) =>
          Date.parse(observation.capturedAt) <
            Date.parse(document.completedAt) ||
          Date.parse(observation.capturedAt) > Date.parse(page.capturedAt),
      )
    )
      throw new Error(
        "Campaign extraction lacks complete observed main context",
      );
    if (
      extracted.disclosures.some(
        (disclosure) =>
          !normalized(page.visibleText).includes(normalized(disclosure)),
      )
    )
      throw new Error(
        "Campaign legal publisher is not present in observed visible text",
      );
    if (
      /captcha|verify (?:you are|that you are) human|access denied|checking your browser/i.test(
        extracted.substantive,
      )
    )
      throw new Error(
        "Interactive challenge cannot supply rendered campaign evidence",
      );
  }
  return { archive, earliest: new Date(earliest).toISOString() };
}

export function campaignRenderSemanticDigest(archive: CampaignRenderArchive) {
  return campaignArchiveHash(
    JSON.stringify({
      kind: "rendered-campaign-semantics-v1",
      candidateId: archive.candidateId,
      ownershipDigest: archive.ownershipDigest,
      pages: archive.pages.map((page) => ({
        url: page.url,
        text: formatRenderedCampaignHtml(page.evidenceDomHtml, page.url).text,
      })),
    }),
  );
}
export function encodeCampaignRenderSources(
  value: CampaignRenderArchive,
): ResearchSource[] {
  const { archive, earliest } = validateCampaignRenderArchive(value);
  const semanticDigest = campaignRenderSemanticDigest(archive);
  const bytes = gzipSync(Buffer.from(JSON.stringify(archive)), { level: 9 });
  if (bytes.length > 1_400_000)
    throw new Error(
      "Compressed campaign archive leaves insufficient dossier capacity",
    );
  const archiveId = `campaign-render-archive-${semanticDigest}`;
  const text = JSON.stringify({
    kind: "campaign_render_archive_v1",
    semanticDigest,
    encoding: "gzip-json",
  });
  const firstPage = archive.pages[0];
  if (!firstPage) throw new Error("Campaign archive has no page");
  const stored: ResearchSource = {
    id: archiveId,
    url: firstPage.url,
    publisher: "Private campaign rendering archive",
    format: "render_archive",
    text,
    contentHash: campaignArchiveHash(text),
    binaryBase64: bytes.toString("base64"),
    byteHash: campaignArchiveHash(bytes),
    fetchedAt: earliest,
    acquisition: { kind: "campaign_render_archive_v1", semanticDigest },
  };
  return [
    stored,
    ...archive.pages.map((page, pageIndex): ResearchSource => {
      const text = formatRenderedCampaignHtml(
        page.evidenceDomHtml,
        page.url,
      ).text;
      return {
        id: `source-${campaignArchiveHash(pageIndex === 0 ? archive.requestedUrl : page.url).slice(0, 24)}`,
        url: page.url,
        publisher: new URL(page.url).hostname,
        format: "html",
        text,
        contentHash: campaignArchiveHash(text),
        byteHash: page.initialBodyHash,
        fetchedAt: earliest,
        acquisition: {
          kind: "rendered_campaign_v1",
          archiveSourceId: archiveId,
          pageIndex,
          semanticDigest,
        },
        retrievalUrls:
          pageIndex === 0
            ? archive.responses
                .slice(0, archive.initialResponseCount)
                .map((row) => row.url)
            : [page.url],
      };
    }),
  ];
}

export function validateCampaignRenderSources(
  sources: ResearchSource[],
  expected?: { candidateId: string; ownershipDigest: string },
) {
  const rendered = sources.filter((source) => source.acquisition);
  if (!rendered.length) return;
  if (new Set(sources.map((source) => source.id)).size !== sources.length)
    throw new Error("Duplicate campaign source identities are ambiguous");
  const canonicalSourceIds = new Set<string>();
  for (const stored of rendered.filter(
    (source) => source.acquisition?.kind === "campaign_render_archive_v1",
  )) {
    if (
      stored.format !== "render_archive" ||
      !stored.binaryBase64 ||
      !stored.byteHash
    )
      throw new Error("Campaign rendering archive is missing");
    const compressed = Buffer.from(stored.binaryBase64, "base64");
    if (
      compressed.length > 1_400_000 ||
      campaignArchiveHash(compressed) !== stored.byteHash
    )
      throw new Error("Campaign rendering archive hash or size mismatch");
    const value: unknown = JSON.parse(
      gunzipSync(compressed, { maxOutputLength: 24_000_000 }).toString("utf8"),
    );
    const { archive } = validateCampaignRenderArchive(value);
    if (
      expected &&
      (archive.candidateId !== expected.candidateId ||
        archive.ownershipDigest !== expected.ownershipDigest)
    )
      throw new Error(
        "Rendered campaign belongs to a different candidate or ownership proof",
      );
    const rebuilt = encodeCampaignRenderSources(archive);
    if (stored.id !== rebuilt[0]?.id)
      throw new Error("Campaign archive identity is not canonical");
    for (const original of rebuilt) {
      canonicalSourceIds.add(original.id);
      const current = sources.find((source) => source.id === original.id);
      if (
        current?.url !== original.url ||
        current.format !== original.format ||
        current.publisher !== original.publisher ||
        current.text !== original.text ||
        current.contentHash !== original.contentHash ||
        (original.format !== "render_archive" &&
          (current.byteHash !== original.byteHash ||
            current.binaryBase64 !== original.binaryBase64)) ||
        current.fetchedAt !== original.fetchedAt ||
        JSON.stringify(current.acquisition) !==
          JSON.stringify(original.acquisition) ||
        JSON.stringify(current.retrievalUrls ?? null) !==
          JSON.stringify(original.retrievalUrls ?? null)
      )
        throw new Error(
          "Rendered campaign source does not replay its immutable archive",
        );
    }
  }
  for (const source of rendered) {
    if (!canonicalSourceIds.has(source.id))
      throw new Error(
        "Rendered campaign source is not a canonical archived page",
      );
    const acquisition = source.acquisition;
    if (
      acquisition?.kind === "rendered_campaign_v1" &&
      !sources.some(
        (stored) =>
          stored.id === acquisition.archiveSourceId &&
          stored.acquisition?.kind === "campaign_render_archive_v1",
      )
    )
      throw new Error("Rendered campaign source references an absent archive");
  }
}
