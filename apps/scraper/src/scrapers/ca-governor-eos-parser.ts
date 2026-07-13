import * as cheerio from "cheerio";
import TurndownService from "turndown";

export const CA_GOV_EO_ROOT = "https://www.gov.ca.gov";
export const CA_GOV_EO_INDEX = `${CA_GOV_EO_ROOT}/category/executive-orders/`;
export const CA_GOV_EO_STRUCTURE_VERSION = "ca-gov-eo-v1";

export interface CaGovernorEoIndexPage {
  postUrls: string[];
  nextPageUrl?: string;
}

export interface CaGovernorEoPost {
  title: string;
  publishedDate: Date;
  description?: string;
  pdfUrl?: string;
  articleText?: string;
}

function absoluteUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
}

export function parseCaGovernorEoIndex(html: string, pageUrl = CA_GOV_EO_INDEX): CaGovernorEoIndexPage {
  const $ = cheerio.load(html);
  const postUrls = new Set<string>();
  $("article a[href], main a[href]").each((_, element) => {
    const url = absoluteUrl($(element).attr("href"), pageUrl);
    if (url && /^https:\/\/www\.gov\.ca\.gov\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+\/?$/i.test(url)) {
      postUrls.add(url);
    }
  });
  const nextHref = $("link[rel='next']").attr("href")
    ?? $("a.next.page-numbers, a[rel='next']").first().attr("href");
  return { postUrls: [...postUrls], nextPageUrl: absoluteUrl(nextHref, pageUrl) };
}

function meta($: cheerio.CheerioAPI, property: string): string | undefined {
  return $(`meta[property='${property}'], meta[name='${property}']`).first().attr("content")?.trim() || undefined;
}

export function parseCaGovernorEoPost(html: string, postUrl: string): CaGovernorEoPost | null {
  const $ = cheerio.load(html);
  const title = meta($, "og:title")
    ?? $("article h1, main h1, h1").first().text().trim();
  if (!title) return null;
  const dateValue = meta($, "article:published_time")
    ?? $("time[datetime]").first().attr("datetime")
    ?? html.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\b/i)?.[0];
  const publishedDate = dateValue ? new Date(dateValue) : new Date(Number.NaN);
  if (Number.isNaN(publishedDate.getTime())) return null;

  const article = $("article .entry-content, article .et_pb_post_content, article, main").first();
  article.find("script, style, nav, form, aside, .sharedaddy, .addtoany_share_save_container").remove();
  const pdfHref = article.find("a[href$='.pdf'], a[href*='.pdf?']").toArray()
    .map((element) => $(element).attr("href"))
    .find(Boolean);
  const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
  const articleText = turndown.turndown(article.html() ?? "").trim() || undefined;
  const description = meta($, "description") ?? meta($, "og:description");
  return {
    title: title.replace(/\s*\|\s*Governor of California\s*$/i, "").trim(),
    publishedDate,
    description,
    pdfUrl: absoluteUrl(pdfHref, postUrl),
    articleText,
  };
}

export function extractExecutiveOrderNumber(text: string): string | undefined {
  return text.match(/\b(?:EXECUTIVE\s+ORDER\s+)?([A-Z]+-\d{1,2}-\d{2})\b/i)?.[1]?.toUpperCase();
}

export function classifyExecutiveOrderSubject(title: string, text: string): string {
  const value = `${title} ${text.slice(0, 5000)}`.toLowerCase();
  const groups: [string, RegExp][] = [
    ["Water and drought", /\bwater\b|drought|groundwater|reservoir|watershed/],
    ["Climate and energy", /climate|clean energy|emission|electricity|carbon|renewable/],
    ["Housing and land use", /housing|homeless|tenant|rent|zoning|land use/],
    ["Transportation", /transit|transportation|rail|highway|vehicle/],
    ["Health and human services", /health|hospital|medical|public health|behavioral/],
    ["Technology and privacy", /artificial intelligence|\bai\b|technology|cyber|privacy|data/],
    ["Economic and workforce policy", /worker|workforce|employment|business|economic|labor/],
    ["Government administration", /state agenc|procurement|state employee|administration|appointment/],
    ["Emergency management", /wildfire|firestorm|earthquake|storm|flood|emergency|disaster|recovery/],
  ];
  return groups.find(([, pattern]) => pattern.test(value))?.[0] ?? "General government";
}

export function formatExecutiveOrderText(args: {
  orderNumber?: string;
  subjectArea: string;
  sourcePostUrl: string;
  sourceDocumentUrl?: string;
  body: string;
}): string {
  return [
    `Source structure: ${CA_GOV_EO_STRUCTURE_VERSION}`,
    `Executive order: ${args.orderNumber ?? "Not stated"}`,
    `Subject area: ${args.subjectArea}`,
    `Source post: ${args.sourcePostUrl}`,
    args.sourceDocumentUrl ? `Signed document: ${args.sourceDocumentUrl}` : undefined,
    "",
    args.body.trim(),
  ].filter((value): value is string => value !== undefined).join("\n");
}
