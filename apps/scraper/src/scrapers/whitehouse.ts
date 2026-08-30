import * as cheerio from "cheerio";
import TurndownService from "turndown";

import type { Scraper } from "../utils/types.js";
import { getItemLimit } from "../utils/concurrency.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import { upsertContent } from "../utils/db/operations.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import { createNewItemLimiter } from "../utils/new-item-limit.js";
import { whitehouseConfig } from "./whitehouse.config.js";

const NAME = "White House";
const FEED_URL = "https://www.whitehouse.gov/presidential-actions/feed/";
const logger = createLogger(NAME);

/**
 * Feed categories worth storing, mapped onto the `government_content.type`
 * values the Federal Register scraper already writes so both sources produce
 * one vocabulary rather than two.
 *
 * "Nominations & Appointments" is deliberately absent: those posts are bare
 * lists of nominee names with no civic substance to summarise, and each one
 * ingested would draw a brief, a dual-lens pass and header art.
 */
const CATEGORY_TYPES = new Map<string, string>([
  ["Executive Orders", "Executive Order"],
  ["Proclamations", "Proclamation"],
  ["Presidential Memoranda", "Memorandum"],
]);

export interface FeedItem {
  title: string;
  url: string;
  type: string;
  publishedDate: Date;
  bodyHtml: string;
}

/**
 * Turns the presidential-actions RSS into items ready for `upsertContent`.
 *
 * Split out from the fetch so the mapping can be tested against a captured
 * feed. The previous whitehouse.gov scraper was removed in 0a2a8ab because it
 * walked the site with CSS selectors that broke whenever the page layout
 * moved; RSS is a contract rather than a layout, carries the full document
 * body inline as `content:encoded`, and costs one request instead of one per
 * article.
 */
export function parseFeed(xml: string): FeedItem[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: FeedItem[] = [];

  $("item").each((_, element) => {
    const item = $(element);
    const title = item.children("title").first().text().trim();
    const url = item.children("link").first().text().trim();
    const pubDate = item.children("pubDate").first().text().trim();

    const categories = item
      .children("category")
      .map((_index, node) => $(node).text().trim())
      .get();

    // An item usually carries the umbrella "Presidential Actions" category
    // alongside its specific one, so look for any category we recognise rather
    // than assuming a position.
    const type = categories
      .map((category) => CATEGORY_TYPES.get(category))
      .find((mapped) => mapped !== undefined);
    if (!type) return;

    const bodyHtml = item
      .children()
      .filter(
        (_index, node) =>
          "tagName" in node && node.tagName === "content:encoded",
      )
      .first()
      .text()
      .trim();

    const parsedDate = new Date(pubDate);
    if (!title || !url || Number.isNaN(parsedDate.getTime())) return;

    items.push({ title, url, type, publishedDate: parsedDate, bodyHtml });
  });

  return items;
}

async function scrape(maxItems = 20) {
  logger.info("Starting...");

  const res = await fetchWithRetry(FEED_URL, { timeoutMs: 30_000 });
  const xml = await res.text();

  const parsed = parseFeed(xml);
  const items = parsed.slice(0, maxItems);
  logger.info(
    `Parsed ${parsed.length} storable actions from the feed, taking ${items.length}`,
  );
  setExpectedTotal(items.length);

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  const limit = getItemLimit();
  const newItemLimiter = createNewItemLimiter();
  await Promise.allSettled(
    items.map((item) =>
      limit(async () => {
        try {
          const fullText = item.bodyHtml
            ? turndown.turndown(item.bodyHtml).trim() || undefined
            : undefined;

          const outcome = await upsertContent(
            {
              type: "government_content",
              data: {
                title: item.title,
                type: item.type,
                publishedDate: item.publishedDate,
                fullText,
                url: item.url,
                source: "whitehouse.gov",
              },
            },
            { newItemLimiter },
          );

          if (outcome.status === "written") {
            logger.success(`Scraped ${item.type}: ${item.title}`);
          } else {
            logger.warn(
              `${outcome.status === "deferred" ? "Deferred" : "Skipped"} ${item.url}: ${outcome.reason}`,
            );
          }
        } catch (error) {
          logger.error(`Error processing ${item.url}`, error);
        }
      }),
    ),
  );

  logger.success("Completed");
}

export const whitehouse: Scraper = {
  ...whitehouseConfig,
  scrape: (options) =>
    scrape(
      (options?.maxItems ?? Number(process.env.WHITEHOUSE_MAX_ITEMS)) || 20,
    ),
};
