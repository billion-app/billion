import { CheerioCrawler } from "crawlee";
import TurndownService from "turndown";

import { generateAISummary } from "../utils/ai/text-generation.js";
import { upsertPresidentialAction } from "../utils/db/operations.js";
import { resetMetrics, printMetricsSummary } from "../utils/db/metrics.js";

// Convert all-caps text to title case
function toTitleCase(text: string): string {
  // Check if text is mostly uppercase (more than 50% uppercase letters)
  const uppercaseCount = (text.match(/[A-Z]/g) || []).length;
  const letterCount = (text.match(/[a-zA-Z]/g) || []).length;

  if (letterCount === 0 || uppercaseCount / letterCount < 0.5) {
    // Not mostly uppercase, return as-is
    return text;
  }

  // Convert to title case
  return (
    text
      .toLowerCase()
      .split(" ")
      .map((word) => {
        // Don't capitalize small words in the middle
        const smallWords = [
          "a",
          "an",
          "and",
          "as",
          "at",
          "but",
          "by",
          "for",
          "in",
          "nor",
          "of",
          "on",
          "or",
          "so",
          "the",
          "to",
          "up",
          "yet",
        ];

        // Always capitalize first letter of first word
        if (word.length === 0) return word;

        // Capitalize first letter, keep rest lowercase
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ")
      // Always capitalize first word
      .replace(/^./, (char) => char.toUpperCase())
  );
}

export async function scrapeWhiteHouse() {
  console.log("Starting White House scraper...");

  // Reset metrics for this scraper run
  resetMetrics();

  const collectedLinks = new Set<string>();
  const maxArticles = 20;
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  const crawler = new CheerioCrawler({
    async requestHandler({ request, $, log, crawler }) {
      log.info(`Scraping ${request.loadedUrl}`);

      // Handle the main news listing page
      if (
        request.url.includes("/news") &&
        (request.url.endsWith("/news") ||
          request.url.endsWith("/news/") ||
          request.url.includes("/news/page/"))
      ) {
        // Extract article links using the specified selector
        $(".wp-block-post-title > a").each((_, element) => {
          const href = $(element).attr("href");
          if (href && collectedLinks.size < maxArticles) {
            collectedLinks.add(href);
          }
        });

        log.info(`Found ${collectedLinks.size} total article links so far`);

        // If we need more articles, find and queue the next page
        if (collectedLinks.size < maxArticles) {
          const nextPageLink = $(".wp-block-query-pagination-next").attr(
            "href",
          );

          if (nextPageLink) {
            log.info(`Queuing next page: ${nextPageLink}`);
            await crawler.addRequests([nextPageLink]);
          }
        }
      }
      // Handle individual article pages
      else {
        try {
          // Extract headline from the specified selector
          let headline = $(".wp-block-whitehouse-topper__headline")
            .first()
            .text()
            .trim();

          // Fallback to h1 if headline not found
          if (!headline) {
            headline = $("h1").first().text().trim() || "Untitled Article";
          }

          // Convert all-caps titles to title case
          headline = toTitleCase(headline);

          // Extract date from the specified selector
          const dateStr =
            $(".wp-block-post-date > time").first().attr("datetime") ||
            $(".wp-block-post-date > time").first().text().trim();

          const issuedDate = dateStr ? new Date(dateStr) : new Date();

          // Extract content - all elements after the first div in .entry-content
          const entryContent = $(".entry-content").first();
          let fullTextMarkdown = "";

          if (entryContent.length > 0) {
            const children = entryContent.children();
            let firstDivIndex = -1;

            // Find the first div
            children.each((index, element) => {
              if (
                element.tagName.toLowerCase() === "div" &&
                firstDivIndex === -1
              ) {
                firstDivIndex = index;
              }
            });

            // Build HTML string of content after first div
            let contentHtml = "";
            if (firstDivIndex === -1) {
              // No div found, get all content
              contentHtml = entryContent.html() || "";
            } else {
              // Get all elements after the first div
              children.each((index, element) => {
                if (index > firstDivIndex) {
                  contentHtml += $.html(element);
                }
              });
            }

            // Convert HTML to markdown
            fullTextMarkdown = turndownService.turndown(contentHtml).trim();
          }

          // Determine content type from URL
          let contentType = "News Article";
          if (request.url.includes("/fact-sheets/")) {
            contentType = "Fact Sheet";
          } else if (request.url.includes("/briefings-statements/")) {
            contentType = "Briefing Statement";
          } else if (request.url.includes("/presidential-actions/")) {
            contentType = "Presidential Action";
          }

          // Generate AI summary (max 100 characters)
          log.info(`Generating AI summary for: ${headline}`);
          const aiSummary = await generateAISummary(headline, fullTextMarkdown);

          const contentData = {
            title: headline,
            type: contentType,
            publishedDate: issuedDate,
            description: aiSummary, // AI-generated summary (max 100 chars)
            fullText: fullTextMarkdown,
            url: request.url,
            source: "whitehouse.gov",
          };

          log.info(`Scraped ${contentType}: ${headline}`);
          log.info(`AI Summary: ${aiSummary}`);

          // Save to database
          await upsertPresidentialAction(contentData);
        } catch (error) {
          log.error(`Error scraping article from ${request.url}:`, error as Error);
        }
      }
    },
    maxRequestsPerCrawl: 50, // Limit for testing
    requestHandlerTimeoutSecs: 60,
  });

  // Start by crawling the news listing page to collect article links
  await crawler.run(["https://www.whitehouse.gov/news/"]);

  console.log(
    `Collected ${collectedLinks.size} article links, now scraping articles...`,
  );

  // Now scrape each collected article
  if (collectedLinks.size > 0) {
    await crawler.run([...collectedLinks].slice(0, maxArticles));
  }

  console.log("White House scraper completed");

  // Print metrics summary
  printMetricsSummary("White House");
}
