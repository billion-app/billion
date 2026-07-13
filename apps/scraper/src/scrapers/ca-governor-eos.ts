/** California Governor executive-order scraper. Source structure: ca-gov-eo-v1. */
import { extractText } from "unpdf";

import type { Scraper } from "../utils/types.js";
import { getItemLimit } from "../utils/concurrency.js";
import { upsertContent } from "../utils/db/operations.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import {
  CA_GOV_EO_INDEX,
  classifyExecutiveOrderSubject,
  extractExecutiveOrderNumber,
  formatExecutiveOrderText,
  parseCaGovernorEoIndex,
  parseCaGovernorEoPost,
} from "./ca-governor-eos-parser.js";

const logger = createLogger("ca-governor-eos");
const USER_AGENT = "Mozilla/5.0 (compatible; BillionCivicData/1.0; +https://billion.app)";
const POLITENESS_MS = 750;
const DEFAULT_MAX_PAGES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;
async function throttle(): Promise<void> {
  const turn = requestQueue.then(async () => {
    const wait = Math.max(0, POLITENESS_MS - (Date.now() - lastRequestAt));
    if (wait) await sleep(wait);
    lastRequestAt = Date.now();
  });
  requestQueue = turn.catch(() => undefined);
  await turn;
}

async function fetchHtml(url: string): Promise<string> {
  await throttle();
  const response = await fetchWithRetry(url, {
    headers: { Accept: "text/html", "User-Agent": USER_AGENT },
  });
  return response.text();
}

async function fetchPdfText(url: string): Promise<string | undefined> {
  try {
    await throttle();
    const response = await fetchWithRetry(url, {
      timeoutMs: 45_000,
      headers: { Accept: "application/pdf", "User-Agent": USER_AGENT },
    });
    if (!/pdf/i.test(response.headers.get("content-type") ?? "")) return undefined;
    const { text } = await extractText(new Uint8Array(await response.arrayBuffer()));
    const normalized = text.join("\n\n")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return normalized.length >= 200 ? normalized : undefined;
  } catch (error) {
    logger.warn(`Could not extract signed PDF ${url}:`, error);
    return undefined;
  }
}

async function discoverPostUrls(): Promise<string[]> {
  const configured = Number(process.env.CA_GOV_EO_MAX_PAGES ?? DEFAULT_MAX_PAGES);
  const maxPages = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_MAX_PAGES;
  const urls = new Set<string>();
  let pageUrl: string | undefined = CA_GOV_EO_INDEX;
  for (let page = 0; page < maxPages && pageUrl; page++) {
    const parsed = parseCaGovernorEoIndex(await fetchHtml(pageUrl), pageUrl);
    parsed.postUrls.forEach((url) => urls.add(url));
    pageUrl = parsed.nextPageUrl;
  }
  return [...urls];
}

async function processPost(postUrl: string): Promise<void> {
  try {
    const post = parseCaGovernorEoPost(await fetchHtml(postUrl), postUrl);
    if (!post) throw new Error("post structure did not contain a title and publication date");
    const pdfText = post.pdfUrl ? await fetchPdfText(post.pdfUrl) : undefined;
    const body = pdfText ?? post.articleText;
    if (!body || body.length < 200) throw new Error("no usable article or signed-order text");
    const orderNumber = extractExecutiveOrderNumber(pdfText ?? body);
    const subjectArea = classifyExecutiveOrderSubject(post.title, body);
    const fullText = formatExecutiveOrderText({
      orderNumber,
      subjectArea,
      sourcePostUrl: postUrl,
      sourceDocumentUrl: post.pdfUrl,
      body,
    });
    await upsertContent({
      type: "government_content",
      data: {
        title: orderNumber ? `${orderNumber}: ${post.title}` : post.title,
        type: "executive_order",
        publishedDate: post.publishedDate,
        description: post.description,
        fullText,
        url: postUrl,
        source: "CA Governor",
      },
    });
    logger.success(`${orderNumber ?? "Executive order"}: ${post.title}`);
  } catch (error) {
    logger.error(`Failed to process ${postUrl}`, error);
  }
}

async function scrape(): Promise<void> {
  logger.info("Discovering California Governor executive orders…");
  const postUrls = await discoverPostUrls();
  if (!postUrls.length) {
    logger.warn("No executive-order posts found; aborting without database changes.");
    return;
  }
  setExpectedTotal(postUrls.length);
  const limit = getItemLimit();
  await Promise.allSettled(postUrls.map((url) => limit(() => processPost(url))));
  logger.success(`Completed ${postUrls.length} California executive-order posts.`);
}

export const caGovernorEos: Scraper = { name: "ca-governor-eos", scrape };
