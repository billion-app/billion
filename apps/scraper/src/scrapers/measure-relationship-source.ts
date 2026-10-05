import { createHash } from "node:crypto";

import { relationshipSourceUrls } from "@acme/api/lib/measure-relationships";

/** Bounded original document bytes; redirect and host checks preserve source identity. */
export async function fetchRelationshipDocument(url: string): Promise<Buffer> {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !["voterguide.sos.ca.gov", "vig.cdn.sos.ca.gov"].includes(parsed.hostname)
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
/** Refresh only the bounded reviewed registry. Missing sources suppress dependent publication. */
export async function collectRelationshipDocumentHashes(
  electionDate: string,
  revisions?: readonly unknown[],
) {
  const hashes: { url: string; hash: string }[] = [];
  for (const url of relationshipSourceUrls(electionDate, revisions)) {
    try {
      const bytes = await fetchRelationshipDocument(url);
      hashes.push({
        url,
        hash: createHash("sha256").update(bytes).digest("hex"),
      });
    } catch {
      /* An omitted hash intentionally invalidates the relationship. */
    }
  }
  return hashes;
}
