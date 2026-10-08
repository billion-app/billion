import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { load } from "cheerio";
import { extractText } from "unpdf";

import { requestPublicSource } from "./transport.js";

const privateNetworks = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  privateNetworks.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
] as const)
  privateNetworks.addSubnet(address, prefix, "ipv6");

export function canonicalSourceUrl(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Source URL must be HTTP(S) without credentials");
  url.hash = "";
  for (const key of [...url.searchParams.keys()])
    if (key.startsWith("utm_") || ["fbclid", "gclid"].includes(key))
      url.searchParams.delete(key);
  return url.toString();
}

export async function publicSourceAddresses(url: string) {
  const parsed = new URL(canonicalSourceUrl(url));
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((entry) =>
      privateNetworks.check(
        entry.address,
        entry.family === 6 ? "ipv6" : "ipv4",
      ),
    )
  )
    throw new Error("Private source addresses are not permitted");
  return addresses;
}

export async function validatePublicSource(url: string) {
  await publicSourceAddresses(url);
}

async function boundedBytes(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Source response has no body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes)
        throw new Error("Source exceeds retrieval size limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}

/** Revalidate every redirect; never let discovered URLs reach private services. */
export async function retrieveSource(
  value: string,
  transport = requestPublicSource,
): Promise<{ url: string; title: string; body: string }> {
  let url = canonicalSourceUrl(value);
  const signal = AbortSignal.timeout(30_000);
  for (let redirects = 0; redirects <= 4; redirects++) {
    const addresses = await publicSourceAddresses(url);
    const response = await transport(url, addresses, signal);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const next = response.headers.get("location");
      if (!next) throw new Error("Source redirect has no location");
      url = canonicalSourceUrl(new URL(next, url).toString());
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Source retrieval failed (HTTP ${response.status})`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    const isPdf = contentType.includes("application/pdf");
    if (
      !isPdf &&
      !/text\/(html|plain)|application\/xhtml\+xml/.test(contentType)
    ) {
      await response.body?.cancel();
      throw new Error("Unsupported source content type");
    }
    const bytes = await boundedBytes(response, isPdf ? 10_000_000 : 2_000_000);
    let body: string;
    let title = url;
    if (isPdf)
      body = (await extractText(new Uint8Array(bytes), { mergePages: true }))
        .text;
    else if (contentType.includes("text/plain")) body = bytes.toString("utf8");
    else {
      const $ = load(bytes.toString("utf8"));
      title = $("title").first().text().trim() || url;
      $("script, style, nav, header, footer, noscript, svg").remove();
      body =
        $("main").first().text() ||
        $("article").first().text() ||
        $("body").text();
    }
    body = body.replace(/\s+/g, " ").trim().slice(0, 200_000);
    if (body.length < 100)
      throw new Error("Source has insufficient readable text");
    return { url, title, body };
  }
  throw new Error("Source exceeded redirect limit");
}
