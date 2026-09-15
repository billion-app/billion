import { load } from "cheerio";

import { parseSantaCruzLocations } from "./santa-cruz-locations-parser.js";

async function fetchCountyPage(url: string): Promise<string> {
  const u = new URL(url);
  if (
    u.origin !== "https://votescount.santacruzcountyca.gov" ||
    u.username ||
    u.password ||
    !u.pathname.startsWith("/Home/Elections/") ||
    !u.pathname.endsWith(".aspx")
  )
    throw new Error("Expected official county locations URL");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok || !response.body)
      throw new Error(`County source HTTP ${response.status}`);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_000_000) {
        await reader.cancel();
        throw new Error("County source exceeds 1 MB");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    clearTimeout(timer);
  }
}

export async function collectSantaCruzLocations(
  url: string,
  electionDate: string,
  fetchPage = fetchCountyPage,
) {
  const html = await fetchPage(url);
  if (new URL(url).pathname.endsWith("/VoteCenterDropBoxLocations.aspx"))
    return parseSantaCruzLocations(html, url, electionDate);
  const $ = load(html);
  const urls = new Set<string>();
  $("a[href]").each((_, el) => {
    const target = new URL($(el).attr("href")!, url);
    if (
      target.origin === new URL(url).origin &&
      target.pathname.endsWith("/VoteCenterDropBoxLocations.aspx") &&
      target.pathname.startsWith(new URL(url).pathname.replace(/\.aspx$/, "/"))
    )
      urls.add(target.href);
  });
  if (urls.size !== 1)
    throw new Error("Election has no unambiguous published location page");
  const source = [...urls][0]!;
  return parseSantaCruzLocations(await fetchPage(source), source, electionDate);
}
