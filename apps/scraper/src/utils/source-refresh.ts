import * as cheerio from "cheerio";
import TurndownService from "turndown";

import { fetchWithRetry } from "./fetch.js";
import { isUsableSourceText } from "./reprocessing-policy.js";

export interface SourceRefreshInput {
  type: "bill" | "government_content" | "court_case";
  url: string;
}

const CONGRESS_BILL_TYPES: Record<string, string> = {
  "house-bill": "hr",
  "senate-bill": "s",
  "house-joint-resolution": "hjres",
  "senate-joint-resolution": "sjres",
  "house-concurrent-resolution": "hconres",
  "senate-concurrent-resolution": "sconres",
  "house-simple-resolution": "hres",
  "senate-simple-resolution": "sres",
};

interface CongressTextVersion {
  formats?: Array<{ type?: string; url?: string }>;
}

function stripHtml(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer, form, noscript, svg").remove();
  return $.root().text().replace(/\s+/g, " ").trim();
}

async function fetchCongressText(url: string): Promise<string | undefined> {
  const parsed = new URL(url);
  const match = parsed.pathname.match(
    /^\/bill\/(\d+)(?:st|nd|rd|th)-congress\/([^/]+)\/(\d+)/i,
  );
  if (!match) return undefined;

  const [, congress, slug, number] = match;
  const billType = CONGRESS_BILL_TYPES[slug!.toLowerCase()];
  const apiKey = process.env.CONGRESS_API_KEY;
  if (!billType || !apiKey) return undefined;

  const endpoint = new URL(
    `https://api.congress.gov/v3/bill/${congress}/${billType}/${number}/text`,
  );
  endpoint.searchParams.set("api_key", apiKey);
  endpoint.searchParams.set("format", "json");
  const response = await fetchWithRetry(endpoint.toString());
  const data = (await response.json()) as {
    textVersions?: CongressTextVersion[];
  };

  for (const version of [...(data.textVersions ?? [])].reverse()) {
    const format = version.formats?.find(
      (candidate) => candidate.type === "Formatted Text" && candidate.url,
    );
    if (!format?.url) continue;
    const textResponse = await fetchWithRetry(format.url);
    const text = stripHtml(await textResponse.text());
    if (isUsableSourceText(text)) return text;
  }
  return undefined;
}

async function fetchFederalRegisterText(
  url: string,
): Promise<string | undefined> {
  const metadataUrl = url.endsWith(".json") ? url : `${url}.json`;
  const response = await fetchWithRetry(metadataUrl, { timeoutMs: 30_000 });
  const metadata = (await response.json()) as { body_html_url?: string | null };
  if (!metadata.body_html_url) return undefined;
  return fetchReadablePage(metadata.body_html_url);
}

async function fetchReadablePage(url: string): Promise<string | undefined> {
  const response = await fetchWithRetry(url, { timeoutMs: 30_000 });
  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer, form, noscript, svg").remove();

  const root = $(
    "article, main, .document-content, .article-content, .opinion-content",
  ).first();
  const selected = root.length > 0 ? root.html() : $("body").html();
  if (!selected) return undefined;

  const markdown = new TurndownService({ headingStyle: "atx" })
    .turndown(selected)
    .trim();
  return isUsableSourceText(markdown) ? markdown : undefined;
}

/** Re-fetch source text for a row that the original scrape left empty. */
export async function refreshSourceText(
  input: SourceRefreshInput,
): Promise<string | undefined> {
  try {
    if (input.type === "bill" && input.url.includes("congress.gov/bill/")) {
      return await fetchCongressText(input.url);
    }
    if (
      input.type === "government_content" &&
      input.url.includes("federalregister.gov/documents/")
    ) {
      return await fetchFederalRegisterText(input.url);
    }
    return await fetchReadablePage(input.url);
  } catch {
    return undefined;
  }
}
