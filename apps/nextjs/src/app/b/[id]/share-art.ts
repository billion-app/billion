import { isIP } from "node:net";

import type { ShareableContent } from "./share-copy";
import { headerImage } from "./share-copy";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type ImageFetcher = (url: URL, init: RequestInit) => Promise<Response>;

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  const [first = 0, second = 0] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isPrivateIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version !== 6) return false;

  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

function safeRemoteImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:") return null;
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      isPrivateIp(hostname)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Makes record artwork self-contained before handing the tree to Satori.
 * Remote fetches are bounded and optional: a broken source can remove the art,
 * but it cannot make the entire link preview fail.
 */
export async function loadShareArt(
  content: ShareableContent,
  fetchImage: ImageFetcher = (url, init) => fetch(url, init),
): Promise<string | undefined> {
  const source = headerImage(content);
  if (!source) return undefined;

  if (source.startsWith("data:")) {
    const type = /^data:([^;,]+)[;,]/.exec(source)?.[1]?.toLowerCase();
    return type &&
      ALLOWED_IMAGE_TYPES.has(type) &&
      source.length <= Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 100
      ? source
      : undefined;
  }

  const url = safeRemoteImageUrl(source);
  if (!url) return undefined;

  try {
    let current = url;
    let response: Response | undefined;

    // Image CDNs commonly redirect a stable asset URL to a sized rendition.
    // Follow those hops ourselves so every destination receives the same URL
    // validation instead of letting fetch disappear behind an unchecked hop.
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      const candidate = await fetchImage(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(2500),
      });
      if (![301, 302, 303, 307, 308].includes(candidate.status)) {
        response = candidate;
        break;
      }

      const location = candidate.headers.get("location");
      const next = location
        ? safeRemoteImageUrl(new URL(location, current).toString())
        : null;
      if (!next) return undefined;
      current = next;
    }

    if (!response) return undefined;
    if (!response.ok) return undefined;

    const type = response.headers.get("content-type")?.split(";")[0]?.trim();
    if (!type || !ALLOWED_IMAGE_TYPES.has(type)) return undefined;

    const declaredLength = Number(response.headers.get("content-length"));
    if (declaredLength > MAX_IMAGE_BYTES) return undefined;

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) return undefined;

    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return undefined;
  }
}
