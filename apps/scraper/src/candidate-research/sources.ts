import { createHash } from "node:crypto";
import { load } from "cheerio";
import { extractText } from "unpdf";
import { z } from "zod/v4";

import type { ResearchSource } from "@acme/validators";

import { fetchWithRetry } from "../utils/fetch.js";

export const hash = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
export function htmlText(html: string): string {
  const $ = load(html);
  $("script,style,nav,footer,noscript").remove();
  const body = $("main").length ? $("main") : $("body");
  return normalize(body.text());
}
export async function fetchSource(
  id: string,
  url: string,
  publisher: string,
  format: ResearchSource["format"],
  apiKey?: string,
): Promise<ResearchSource> {
  const response = await fetchWithRetry(url, {
    maxRetries: 0,
    timeoutMs: 30_000,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BillionResearch/1.0)",
      ...(apiKey ? { "X-Api-Key": apiKey } : {}),
    },
  });
  // Bound a single document, never silently truncate it.
  const reader = response.body?.getReader();
  if (!reader) throw new Error(`No body from ${new URL(url).hostname}`);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 25_000_000) {
      await reader.cancel();
      throw new Error("Research source exceeds 25 MB");
    }
    chunks.push(value);
  }
  const buffer = Buffer.concat(chunks);
  let text: string;
  if (format === "pdf") {
    const result = await extractText(new Uint8Array(buffer), {
      mergePages: false,
    });
    text = result.text.map((page, i) => `[Page ${i + 1}]\n${page}`).join("\n");
  } else if (format === "json") {
    text = JSON.stringify(JSON.parse(buffer.toString("utf8")), null, 2);
  } else if (format === "html") text = htmlText(buffer.toString("utf8"));
  else text = new TextDecoder("windows-1252").decode(buffer);
  if (text.length < 20 || text.length > 5_000_000)
    throw new Error(`Unusable ${id} source text`);
  return {
    id,
    url,
    publisher,
    format,
    text,
    contentHash: hash(text),
    fetchedAt: new Date().toISOString(),
  };
}

export function certifiedMembers(
  certified: ResearchSource,
  media: ResearchSource,
) {
  if (!certified.text.includes("November 3, 2026"))
    throw new Error("Wrong certified election date");
  const title = "United States Representative District 17";
  const sections = certified.text.split(title);
  if (sections.length !== 2)
    throw new Error("Expected one certified CA-17 contest");
  const section = sections[1]!
    .split("United States Representative District 18")[0]!
    .trim();
  const rows = section
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const candidates = rows.filter((s) =>
    / (Democratic|Republican|No Party Preference)$/.test(s),
  );
  const feed = media.text
    .split(/\r?\n/)
    .filter((s) => s.startsWith("[C|CAS|"))
    .map((s) => s.slice(1, -1).split("|"))
    .filter((r) => r[3] === "110000170000");
  if (!candidates.length || feed.length !== candidates.length)
    throw new Error("Certified and machine rosters disagree");
  return feed.map((r) => {
    const name = r[10]!;
    const matches = candidates.filter((c) => c.startsWith(`${name} `));
    if (matches.length !== 1 || !/^\d+$/.test(r[4]!))
      throw new Error("Roster identity mismatch");
    const index = rows.indexOf(matches[0]!);
    return {
      candidateId: `ca-sos:2026-11-03:110000170000:${r[4]}`,
      name,
      description: rows[index + 1] ?? null,
      ballotStatus: "on_ballot" as const,
    };
  });
}
const envelope = z.object({
  results: z.array(z.record(z.string(), z.unknown())),
  pagination: z.object({
    count: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative().optional(),
  }),
});
export const fecRows = (source: ResearchSource) =>
  envelope.parse(JSON.parse(source.text));
export function money(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error("Missing or invalid FEC amount");
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(cents / 100 - value) > 0.000001)
    throw new Error("Invalid FEC cents");
  return cents;
}
export function field(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (typeof v !== "string" || !v.trim()) throw new Error(`Missing FEC ${key}`);
  return v;
}
export function processedTransactions(
  source: ResearchSource,
): Record<string, unknown>[] {
  const unique = new Map<string, Record<string, unknown>>();
  for (const row of fecRows(source).results) {
    if (row.memoed_subtotal === true || row.memo_code === "X") continue;
    const id = field(row, "sub_id");
    const previous = unique.get(id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row))
      throw new Error("Conflicting FEC transaction ID");
    unique.set(id, row);
  }
  return [...unique.values()];
}
