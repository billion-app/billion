import { load } from "cheerio";

import type { PollReportSource } from "./ca-election-polling-parser.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";

const logger = createLogger("ca-election-polling");
const PPIC_INDEX = "https://www.ppic.org/survey/";
export const PPIC_REPORT_CATALOG = [
  {
    reportId: "crosstabs-likely-voters-1026",
    sourceUrl:
      "https://www.ppic.org/wp-content/uploads/crosstabs-likely-voters-1026.pdf",
    publicationUrl:
      "https://www.ppic.org/publication/ppic-statewide-survey-californians-and-their-government-october-2026/",
    publishedAt: "2026-10-27",
    expectedObservationCount: 15,
    publicationDateSource:
      "https://www.ppic.org/press-release/californians-head-to-polls-in-historically-sour-mood-billionaire-wealth-tax-slips-below-majority-support/",
  },
] as const;
export async function fetchPpic(url: string): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "www.ppic.org")
    throw new Error("Unsupported polling source URL");
  return fetchWithRetry(url, {
    maxRetries: 2,
    timeoutMs: 30_000,
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/pdf,text/html",
    },
  });
}
export async function discoverPpicReports(
  read = fetchPpic,
): Promise<PollReportSource[]> {
  const reports = new Map<string, PollReportSource>(
    PPIC_REPORT_CATALOG.map((report) => [report.sourceUrl, report]),
  );
  let html: string;
  try {
    html = await (await read(PPIC_INDEX)).text();
  } catch (error) {
    logger.warn(
      "PPIC survey index unavailable; refreshing the researched report catalog only",
      error,
    );
    return [...reports.values()];
  }
  const $ = load(html);
  const publicationUrls = new Set<string>();
  $("a[href]").each((_, element) => {
    const raw = $(element).attr("href");
    if (!raw) return;
    const url = new URL(raw, PPIC_INDEX);
    if (
      url.hostname === "www.ppic.org" &&
      /(?:october|november|december)-2026\/$/.test(url.pathname) &&
      /^\/publication\/ppic-statewide-survey-californians-and-their-government-[a-z]+-2026\/$/.test(
        url.pathname,
      )
    )
      publicationUrls.add(url.href);
  });
  for (const publicationUrl of publicationUrls) {
    const known = PPIC_REPORT_CATALOG.some(
      (report) => report.publicationUrl === publicationUrl,
    );
    let publication: string;
    try {
      publication = await (await read(publicationUrl)).text();
    } catch (error) {
      if (!known)
        throw new Error(
          `New PPIC survey publication could not be inspected ${publicationUrl}`,
          { cause: error },
        );
      logger.warn(
        `Known PPIC publication unavailable; using researched catalog metadata ${publicationUrl}`,
      );
      continue;
    }
    const page = load(publication);
    const published =
      page('meta[property="article:published_time"]')
        .attr("content")
        ?.slice(0, 10) ?? null;
    let found = false;
    page("a[href]").each((_, element) => {
      const raw = page(element).attr("href");
      if (!raw) return;
      const url = new URL(raw, publicationUrl);
      if (
        url.hostname !== "www.ppic.org" ||
        !/^\/wp-content\/uploads\/crosstabs-likely-voters-[\w-]+\.pdf$/.test(
          url.pathname,
        )
      )
        return;
      found = true;
      const existing = reports.get(url.href);
      reports.set(url.href, {
        ...existing,
        reportId: url.pathname
          .split("/")
          .at(-1)!
          .replace(/\.pdf$/, ""),
        sourceUrl: url.href,
        publishedAt: published ?? existing?.publishedAt ?? null,
      });
    });
    if (!found && !known)
      throw new Error(
        `New PPIC survey has no supported likely-voter PDF ${publicationUrl}`,
      );
  }
  return [...reports.values()].sort(
    (a, b) =>
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") ||
      b.reportId.localeCompare(a.reportId),
  );
}
