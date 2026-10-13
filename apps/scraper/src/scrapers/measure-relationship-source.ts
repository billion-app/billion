import { createHash } from "node:crypto";
import { load } from "cheerio";

import { relationshipSourceUrls } from "@acme/api/lib/measure-relationships";
import { TRILLION_PRECEDENT_HOSTS } from "@acme/validators";

/** Bounded original document bytes; redirect and host checks preserve source identity. */
export async function fetchRelationshipDocument(url: string): Promise<Buffer> {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    ![
      "voterguide.sos.ca.gov",
      "vig.cdn.sos.ca.gov",
      // Trillion precedent: archived official PDFs.
      ...TRILLION_PRECEDENT_HOSTS,
    ].includes(parsed.hostname)
  )
    throw new Error("Unexpected relationship source host");
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || !response.body)
    throw new Error("Relationship source unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > 5000000) {
      await reader.cancel();
      throw new Error("Source exceeds 5 MB");
    }
    chunks.push(next.value);
  }
  return Buffer.concat(chunks);
}
/**
 * Readable text of an official guide HTML page. The site injects a randomized
 * bot-protection script on every response, so raw HTML bytes never repeat;
 * freshness for these pages compares this text instead.
 */
export function officialPageText(url: string, html: string): string {
  const $ = load(html);
  const text = $("#mainCont").text().replace(/\s+/g, " ").trim();
  if (!url.endsWith("analysis.htm")) return text;
  return (
    text +
    " " +
    $("#mainCont img")
      .map((_, image) => $(image).attr("alt") ?? "")
      .get()
      .join(" ")
  );
}
/** PDFs hash their bytes; guide HTML pages hash their readable text. */
export function documentFreshnessHash(url: string, bytes: Buffer): string {
  const content = url.endsWith(".htm")
    ? officialPageText(url, bytes.toString("utf8"))
    : bytes;
  return createHash("sha256").update(content).digest("hex");
}
/** Refresh only the bounded reviewed registry. Missing sources suppress dependent publication. */
export async function collectRelationshipDocumentHashes(
  electionDate: string,
  revisions?: readonly unknown[],
  extraUrls: readonly string[] = [],
) {
  const hashes: { url: string; hash: string }[] = [];
  const urls = new Set([
    ...relationshipSourceUrls(electionDate, revisions),
    ...extraUrls,
  ]);
  if (urls.size > 200) throw new Error("Source registry exceeds 200 documents");
  for (const url of urls) {
    try {
      const bytes = await fetchRelationshipDocument(url);
      hashes.push({ url, hash: documentFreshnessHash(url, bytes) });
    } catch {
      /* An omitted hash intentionally invalidates the relationship. */
    }
  }
  return hashes;
}
