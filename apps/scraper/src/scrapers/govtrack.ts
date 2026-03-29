import { CheerioCrawler } from "crawlee";

import { printMetricsSummary, resetMetrics } from "../utils/db/metrics.js";
import { upsertBill } from "../utils/db/operations.js";

interface GovTrackScraperConfig {
  maxBills?: number; // Default: 100
  maxRequests?: number; // Default: 500
  congress?: number; // Default: 119
}

export async function scrapeGovTrack(config: GovTrackScraperConfig = {}) {
  const { maxBills = 100, maxRequests = 500, congress = 119 } = config;
  console.log("Starting GovTrack scraper...");

  // Reset metrics for this scraper run
  resetMetrics();

  const collectedLinks = new Set<string>();

  const crawler = new CheerioCrawler({
    async requestHandler({ request, $, log, crawler }) {
      log.info(`Scraping ${request.loadedUrl}`);

      // Handle the main listing page
      if (
        request.url.includes("/congress/bills") &&
        (request.url.endsWith("/congress/bills") ||
          request.url.endsWith("/congress/bills/") ||
          request.url.includes("#docket"))
      ) {
        // Extract bill links from the listing page
        $('.card > .card-body .card-title > a[href*="/congress/bills/"]').each(
          (_, element) => {
            const href = $(element).attr("href");
            if (href && /\/congress\/bills\/\d+\/[a-z]+\d+/.test(href)) {
              // Convert relative URLs to absolute
              const fullUrl = href.startsWith("http")
                ? href
                : `https://www.govtrack.us${href}`;

              if (collectedLinks.size < maxBills) {
                collectedLinks.add(fullUrl);
              }
            }
          },
        );

        log.info(`Found ${collectedLinks.size} total bill links so far`);

        // // Look for pagination links
        // if (collectedLinks.size < maxBills) {
        //   const nextPageLink = $(
        //     'a.next-page, a[rel="next"], a:contains("Next")',
        //   ).attr("href");
        //   if (nextPageLink) {
        //     const fullNextUrl = nextPageLink.startsWith("http")
        //       ? nextPageLink
        //       : `https://www.govtrack.us${nextPageLink}`;
        //     log.info(`Found next page: ${fullNextUrl}`);
        //     await crawler.addRequests([fullNextUrl]);
        //   }
        // }
      }
      // Handle bill text pages
      else if (request.url.includes("/text")) {
        try {
          // Remove script/style/nav nodes before extracting text
          $("#main_text_content script, #main_text_content style, #main_text_content nav").remove();
          let fullText = $("#main_text_content").text().trim();

          // Reject garbage text: Windows file paths, "Examples:" prefix, or "IB " prefix
          if (
            /[A-Z]:\\/.test(fullText) ||
            fullText.startsWith("Examples:") ||
            fullText.startsWith("IB ")
          ) {
            log.warning(`Rejecting garbage full_text for ${request.url}`);
            fullText = "";
          }

          // Truncate to 1,000 words
          if (fullText) {
            const words = fullText.split(/\s+/);
            if (words.length > 1000) {
              fullText = words.slice(0, 1000).join(" ");
              log.info(
                `Truncated full text from ${words.length} to 1,000 words`,
              );
            }
          }

          // Extract bill number and title from h1
          const h1Text = $("#maincontent h1").first().text().trim();
          const h1Parts = h1Text.split(":");
          const billNumber = h1Parts[0]?.trim() || "";
          const title =
            h1Parts.length > 1 ? h1Parts.slice(1).join(":").trim() : h1Text;

          // Extract sponsor
          let sponsor: string | undefined;
          // $("p, div").each((_, element) => {
          //   const text = $(element).text();
          //   if (text.includes("Sponsor:")) {
          //     sponsor = text.replace("Sponsor:", "").trim();
          //     return false; // break
          //   }
          // });

          // Extract status
          const status = $(".bill-status").first().text().trim() || "Unknown";

          // Extract introduced date
          let introducedDate: Date | undefined;
          $("p, div").each((_, element) => {
            const text = $(element).text();
            if (text.includes("Introduced:")) {
              const dateStr = text.replace("Introduced:", "").trim();
              introducedDate = new Date(dateStr);
              return false; // break
            }
          });

          // Extract congress number from URL
          const congressMatch = request.url.match(/\/congress\/bills\/(\d+)\//);
          const congress = congressMatch
            ? parseInt(congressMatch[1]!)
            : undefined;

          // Extract chamber (house/senate) from bill number
          const chamber = billNumber.toLowerCase().startsWith("h.")
            ? "House"
            : "Senate";

          // Extract summary
          const summary = $(".summary").first().text().trim() || undefined;

          // Remove /text from the URL to get the original bill URL
          const billUrl = request.url.replace(/\/text$/, "");

          const billData = {
            billNumber,
            title,
            description: summary,
            sponsor,
            status,
            introducedDate,
            congress,
            chamber,
            summary,
            fullText,
            url: billUrl,
            sourceWebsite: "govtrack" as const,
          };

          // console.log(fullText);

          log.info(
            `Scraped bill with full text: ${billNumber} - ${title} (${fullText.length} characters)`,
          );

          // Save complete bill data with full text

          if (fullText != "") {
            await upsertBill(billData);
          }
        } catch (error) {
          console.log(error);
          log.error(`Error scraping full text from ${request.url}:`, error as Error);
        }
      }
    },
    maxRequestsPerCrawl: maxRequests,
    requestHandlerTimeoutSecs: 60,
  });

  // Start by crawling the bills listing page to collect bill links
  await crawler.run(["https://www.govtrack.us/congress/bills/#docket"]);

  console.log(
    `Collected ${collectedLinks.size} bill links, now scraping bills...`,
  );

  // Now scrape text pages directly (they have all the info we need)
  if (collectedLinks.size > 0) {
    const billUrls = [...collectedLinks].slice(0, maxBills);
    const textUrls = billUrls.map((url) => `${url}/text`);

    console.log(
      `Scraping ${textUrls.length} text pages with full bill data...`,
    );
    await crawler.run(textUrls);
  }

  console.log("GovTrack scraper completed");

  // Print metrics summary
  printMetricsSummary("GovTrack");
}
