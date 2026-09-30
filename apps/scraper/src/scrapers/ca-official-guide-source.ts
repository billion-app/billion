import { officialGuidePayloadSchema } from "@acme/api/lib/official-guide-cache";

import {
  GUIDE_BASE,
  guideElectionDate,
  guideLinks,
  parseGuideCandidates,
  parseGuideMeasure,
} from "./ca-official-guide-parser.js";

export async function fetchGuidePage(url: string): Promise<string> {
  if (new URL(url).origin !== GUIDE_BASE)
    throw new Error("Unexpected guide host");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
      headers: {
        Accept: "text/html",
        "User-Agent": "BillionCivicBot/1.0 (+https://billion.app)",
      },
    });
    if (!response.ok || !response.body)
      throw new Error(`Guide HTTP ${response.status}: ${url}`);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_000_000) {
        await reader.cancel();
        throw new Error("Guide page exceeds 1 MB");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    clearTimeout(timer);
  }
}
/** No DB or model calls. maxItems bounds detail pages; the two index reads are fixed. */
export async function collectOfficialGuide(
  electionDate: string,
  maxItems = 40,
  fetchPage = fetchGuidePage,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(electionDate))
    throw new Error("An exact election date is required");
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 100)
    throw new Error("maxItems must be 1–100");
  const indexes = await Promise.all([
    fetchPage(`${GUIDE_BASE}/propositions/`),
    fetchPage(`${GUIDE_BASE}/candidates/`),
  ]);
  if (indexes.some((html) => guideElectionDate(html) !== electionDate))
    throw new Error(
      "Official guide election does not match requested election date",
    );
  const allPages = [
    ...guideLinks(indexes[0]!, "measures"),
    ...guideLinks(indexes[1]!, "candidates"),
  ];
  const pages = allPages.slice(0, maxItems);
  if (!pages.length) throw new Error("No supported guide pages discovered");
  const payload = officialGuidePayloadSchema.parse({
    electionDate,
    jurisdiction: "CA",
    complete: pages.length === allPages.length,
    fetchedAt: new Date().toISOString(),
    sourceUrl: `${GUIDE_BASE}/`,
    measures: [],
    candidates: [],
  });
  for (const url of pages) {
    const html = await fetchPage(url);
    if (guideElectionDate(html) !== electionDate)
      throw new Error(`Guide changed election while collecting: ${url}`);
    if (url.includes("/propositions/")) {
      const measure = parseGuideMeasure(html, url, electionDate);
      if (!measure) throw new Error(`No measure content parsed: ${url}`);
      payload.measures.push(measure);
    } else
      payload.candidates.push(...parseGuideCandidates(html, url, electionDate));
  }
  return officialGuidePayloadSchema.parse(payload);
}
