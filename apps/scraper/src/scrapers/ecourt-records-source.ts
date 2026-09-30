import { load } from "cheerio";

import type { CourtCaseData } from "../utils/types.js";
import { fetchWithRetry } from "../utils/fetch.js";

export const ECOURT_INDEX = "https://ecourtrecords.org/";

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function date(value: string): Date {
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.valueOf()))
    throw new Error(`Invalid eCourt Records date: ${value}`);
  return parsed;
}

/** The home page is the archive's case index, not a search for a named person. */
export function discoverCriminalCases(html: string): string[] {
  const $ = load(html);
  const urls = new Set<string>();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    const url = new URL(href, ECOURT_INDEX);
    if (
      url.origin === new URL(ECOURT_INDEX).origin &&
      /^\/us\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/\d{4}[a-z]{2}\d+\/[^/]+\/$/i.test(
        url.pathname,
      ) &&
      $(element).closest(".case-card").text().toLowerCase().includes("criminal")
    ) {
      urls.add(url.href);
    }
  });
  // An empty archive is plausible; a changed index structure must be visible.
  if (!$("a[href*='/us/']").length)
    throw new Error("eCourt Records index has no case links");
  if (!urls.size)
    throw new Error("eCourt Records index has no criminal case links");
  return [...urls];
}

export function parseCriminalCase(
  html: string,
  url: string,
  now = new Date(),
): CourtCaseData {
  const $ = load(html);
  const canonical = $("link[rel='canonical']").attr("href");
  if (canonical !== url) throw new Error(`Case canonical URL changed: ${url}`);
  if (!clean($(".case-heading .eyebrow").text()).includes("CRIMINAL CASE"))
    throw new Error(`Not a criminal case: ${url}`);
  const facts = new Map<string, string>();
  $("section.facts > div").each((_, element) => {
    facts.set(
      clean($(element).find("small").text()),
      clean($(element).find("strong").text()),
    );
  });
  const caseNumber = facts.get("CASE NUMBER");
  const court = clean($(".breadcrumb").text().split("/")[1] ?? "");
  const title = clean($(".case-heading h1").text());
  const lede = clean($(".case-heading .lede").text());
  const alias = lede.includes("·") ? clean(lede.split("·").at(-1) ?? "") : "";
  const status = clean($(".case-heading .pill").text());
  const filed = facts.get("FILED");
  const lastEntry = facts.get("LAST DOCKET ENTRY");
  if (!caseNumber || !court || !title || !status || !filed || !lastEntry)
    throw new Error(`Incomplete eCourt Records case metadata: ${url}`);
  if (!url.toLowerCase().includes(`/${caseNumber.toLowerCase()}/`))
    throw new Error(`Case number and URL disagree: ${url}`);

  const charges: string[] = [];
  $("#charges article.content-card").each((_, element) => {
    const charge = clean($(element).text());
    if (charge) charges.push(charge);
  });
  const entries: { when: string; text: string; link: string }[] = [];
  $("#docket article.entry").each((_, element) => {
    const when = $(element).find("time").attr("datetime");
    const docketText = clean($(element).find(".entry-text").text());
    const id = $(element).attr("id");
    if (!when || !docketText || !id)
      throw new Error(`Incomplete docket entry: ${url}`);
    date(when);
    entries.push({ when, text: docketText, link: `${url}#${id}` });
  });
  if (!entries.length || !charges.length)
    throw new Error(`Criminal case lacks charges or docket entries: ${url}`);
  const latest = entries
    .map((entry) => entry.when)
    .sort()
    .at(-1)!;
  const advertisedLatestDate = new Date(lastEntry);
  if (Number.isNaN(advertisedLatestDate.valueOf()))
    throw new Error(`Invalid last docket entry date: ${url}`);
  const advertisedLatest = advertisedLatestDate.toISOString().slice(0, 10);
  if (latest !== advertisedLatest)
    throw new Error(`Last docket entry date disagrees with entries: ${url}`);

  const hearing = clean($("#schedule .content-card").text());
  const scheduled = /\b(\d{2}\/\d{2}\/\d{4})\b/.exec(hearing)?.[1];
  if (status === "Pending" && scheduled) {
    const hearingDate = new Date(`${scheduled} UTC`);
    if (
      !Number.isNaN(hearingDate.valueOf()) &&
      now.valueOf() > hearingDate.valueOf() + 2 * 24 * 60 * 60 * 1000 &&
      date(latest) < hearingDate
    ) {
      throw new Error(
        `eCourt Records snapshot may be stale after scheduled hearing: ${url}`,
      );
    }
  }
  const coverage = clean($("aside .panel").eq(1).text());
  const sourceText = [
    `Source: ${url}`,
    `${title} — ${caseNumber} — ${court}`,
    `Status: ${status}. Filed: ${filed}. Last docket entry: ${lastEntry}.`,
    "Charges (allegations, not findings):",
    ...charges.map((charge) => `- ${charge}`),
    "Docket entries (newest first):",
    ...entries.map((entry) => `- ${entry.when}: ${entry.text} (${entry.link})`),
    hearing ? `Scheduled events (confirm with court): ${hearing}` : "",
    coverage ? `Record coverage: ${coverage}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    caseNumber,
    title:
      alias && !title.toLowerCase().includes(alias.toLowerCase())
        ? `${title} (${alias})`
        : title,
    court,
    // Browse uses the latest recorded court activity, as it does for opinions.
    filedDate: date(latest),
    status,
    description: `${status} criminal case in ${court}. ${charges.length} charges are listed as allegations; latest docket entry ${lastEntry}.`,
    fullText: sourceText,
    url,
  };
}

export async function fetchEcourtPage(url: string): Promise<string> {
  const response = await fetchWithRetry(url, { timeoutMs: 15_000 });
  const text = await response.text();
  if (text.length > 1_000_000)
    throw new Error(`eCourt Records page exceeds 1 MB: ${url}`);
  return text;
}
