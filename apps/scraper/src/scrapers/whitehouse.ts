import * as cheerio from "cheerio";
import TurndownService from "turndown";

import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import { upsertContent } from "../utils/db/operations.js";
import { getItemLimit } from "../utils/concurrency.js";
import { resetMetrics, printMetricsSummary } from "../utils/db/metrics.js";
import type { Scraper } from "../utils/types.js";

const NAME = "White House";
const logger = createLogger(NAME);

function toTitleCase(text: string): string {
  const uppercaseCount = (text.match(/[A-Z]/g) || []).length;
  const letterCount = (text.match(/[a-zA-Z]/g) || []).length;

  if (letterCount === 0 || uppercaseCount / letterCount < 0.5) {
    return text;
  }

  return text
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .replace(/^./, (char) => char.toUpperCase());
}

async function scrape() {
  logger.info("Starting...");
  resetMetrics();

  const maxArticles = 20;
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  const collectedLinks: string[] = [];
  let nextPageUrl: string | null = "https://www.whitehouse.gov/news/";

  while (nextPageUrl && collectedLinks.length < maxArticles) {
    const res = await fetchWithRetry(nextPageUrl, { timeoutMs: 60_000 });
    const html = await res.text();
    const $ = cheerio.load(html);

    $(".wp-block-post-title > a").each((_, element) => {
      const href = $(element).attr("href");
      if (href && collectedLinks.length < maxArticles) {
        collectedLinks.push(href);
      }
    });

    logger.debug(`Found ${collectedLinks.length} article links so far`);

    if (collectedLinks.length < maxArticles) {
      nextPageUrl = $(".wp-block-query-pagination-next").attr("href") || null;
    } else {
      nextPageUrl = null;
    }
  }

  logger.info(`Collected ${collectedLinks.length} articles, now scraping...`);

  const limit = getItemLimit();
  await Promise.allSettled(
    collectedLinks.slice(0, maxArticles).map((articleUrl) =>
      limit(async () => {
        try {
          const res = await fetchWithRetry(articleUrl, { timeoutMs: 60_000 });
          const html = await res.text();
          const $ = cheerio.load(html);

          let headline = $(".wp-block-whitehouse-topper__headline")
            .first()
            .text()
            .trim();
          if (!headline) {
            headline = $("h1").first().text().trim() || "Untitled Article";
          }
          headline = toTitleCase(headline);

          const dateStr =
            $(".wp-block-post-date > time").first().attr("datetime") ||
            $(".wp-block-post-date > time").first().text().trim();
          const issuedDate = dateStr ? new Date(dateStr) : new Date();

          const entryContent = $(".entry-content").first();
          let fullTextMarkdown = "";

          if (entryContent.length > 0) {
            const children = entryContent.children();
            let firstDivIndex = -1;

            children.each((index, element) => {
              if (
                element.tagName.toLowerCase() === "div" &&
                firstDivIndex === -1
              ) {
                firstDivIndex = index;
              }
            });

            let contentHtml = "";
            if (firstDivIndex === -1) {
              contentHtml = entryContent.html() || "";
            } else {
              children.each((index, element) => {
                if (index > firstDivIndex) {
                  contentHtml += $.html(element);
                }
              });
            }

            fullTextMarkdown = turndownService.turndown(contentHtml).trim();
          }

          let contentType = "News Article";
          if (articleUrl.includes("/fact-sheets/")) {
            contentType = "Fact Sheet";
          } else if (articleUrl.includes("/briefings-statements/")) {
            contentType = "Briefing Statement";
          } else if (articleUrl.includes("/presidential-actions/")) {
            contentType = "Presidential Action";
          }

          await upsertContent({
            type: "government_content",
            data: {
              title: headline,
              type: contentType,
              publishedDate: issuedDate,
              description: undefined,
              fullText: fullTextMarkdown,
              url: articleUrl,
              source: "whitehouse.gov",
            },
          });

          logger.success(`Scraped ${contentType}: ${headline}`);
        } catch (error) {
          logger.error(`Error scraping ${articleUrl}`, error);
        }
      }),
    ),
  );

  logger.success("Completed");
  printMetricsSummary(NAME);
}

export const whitehouse: Scraper = {
  name: NAME,
  scrape,
};
