import { Dataset, CheerioCrawler } from "crawlee";

import { printMetricsSummary, resetMetrics } from "../utils/db/metrics.js";
import { upsertBill } from "../utils/db/operations.js";

interface CongressScraperConfig {
  maxBills?: number;        // Default: 100
  maxRequests?: number;     // Default: 500
  congress?: number;        // Default: 119
  chamber?: 'House' | 'Senate';  // Default: 'House'
}

export async function scrapeCongress(config: CongressScraperConfig = {}) {
  const {
    maxBills = 100,
    maxRequests = 500,
    congress = 119,
    chamber = 'House'
  } = config;
  console.log("Starting Congress.gov scraper...");

  // Reset metrics for this scraper run
  resetMetrics();

  const crawler = new CheerioCrawler({
    async requestHandler({ request, $, log, crawler }) {
      log.info(`Scraping ${request.loadedUrl}`);

      // Handle the browse/listing page
      if (
        request.url.includes("/search?q=") && request.url.includes("type%22%3A%22bills")
      ) {
        // Extract bill links with the correct format
        const billLinks: string[] = [];
        $('a[href*="/bill/"]').each((_, element) => {
          const href = $(element).attr('href');
          if (href && /\/bill\/\d+(?:th|st|nd|rd)-congress\/(?:house|senate)-bill\/\d+/i.test(href)) {
            // Make absolute URL if relative
            const fullUrl = href.startsWith('/')
              ? `https://www.congress.gov${href}`
              : href;
            billLinks.push(fullUrl);
          }
        });

        // Remove duplicates and apply limit
        const uniqueBillLinks = [...new Set(billLinks)].slice(0, maxBills);

        log.info(`Found ${uniqueBillLinks.length} bill links from Congress.gov`);

        // Return bill links to be processed
        await Dataset.pushData({
          type: "congressBillLinks",
          links: uniqueBillLinks,
        });

        // Look for pagination - next page link
        if (uniqueBillLinks.length < maxBills) {
          const nextPageLink = $('a.next, a[rel="next"], a:contains("Next")').attr('href');
          if (nextPageLink) {
            const fullNextUrl = nextPageLink.startsWith('http')
              ? nextPageLink
              : `https://www.congress.gov${nextPageLink}`;
            log.info(`Found next page: ${fullNextUrl}`);
            await crawler.addRequests([fullNextUrl]);
          }
        }
      }
      // Handle individual bill pages
      else if (
        /\/bill\/\d+(?:th|st|nd|rd)-congress\/(?:house|senate)-bill\/\d+/i.test(
          request.url,
        )
      ) {
        try {
          // Extract bill number
          let billNumber = "Unknown";
          const billNumberText = $(".bill-number, h1").first().text().trim();
          if (billNumberText) {
            const match = billNumberText.match(
              /([HS]\.\s?(?:R\.|J\.\s?Res\.|Con\.\s?Res\.|Res\.)\s?\d+)/i,
            );
            billNumber = match ? match[1]!.trim() : billNumberText.split(" ")[0] || "Unknown";
          }

          // Extract title
          let title = "Unknown";
          const titleText = $(".bill-title, h1").first().text().trim();
          if (titleText) {
            // Remove bill number from title if present
            let cleanTitle = titleText
              .replace(/[HS]\.\s?(?:R\.|J\.\s?Res\.|Con\.\s?Res\.|Res\.)\s?\d+/i, "")
              .trim();

            // Clean up extra content (JavaScript, metadata, etc.)
            // Take only the first line or up to the first newline/special marker
            cleanTitle = cleanTitle.split('\n')[0]!.trim();
            cleanTitle = cleanTitle.split('$(document)')[0]!.trim();
            cleanTitle = cleanTitle.split('Congress (')[0]!.trim();

            // Truncate to 250 chars to fit DB limit (256) with some buffer
            title = cleanTitle.slice(0, 250) || "Unknown";
          }

          // Extract sponsor
          let sponsor: string | undefined;
          $('*:contains("Sponsor:")').each((_, element) => {
            const text = $(element).text();
            if (text.includes("Sponsor:")) {
              let cleanSponsor = text.replace(/Sponsor:/i, "").trim();
              // Take first line and truncate to fit DB
              cleanSponsor = cleanSponsor.split('\n')[0]!.trim().slice(0, 250);
              sponsor = cleanSponsor || undefined;
              return false; // break
            }
          });

          // Extract status
          let status = $('.bill-status, [class*="status"]').first().text().trim() || "Unknown";
          // Clean and truncate status
          status = status.split('\n')[0]!.trim().slice(0, 250) || "Unknown";

          // Extract introduced date
          let introducedDate: Date | undefined;
          $('*:contains("Introduced:")').each((_, element) => {
            const text = $(element).text();
            if (text.includes("Introduced:")) {
              const dateStr = text.replace(/Introduced:/i, "").trim();
              introducedDate = new Date(dateStr);
              return false; // break
            }
          });

          // Extract congress number from URL
          const congressMatch = request.url.match(
            /\/bill\/(\d+)(?:th|st|nd|rd)-congress/i,
          );
          const congressNum = congressMatch
            ? parseInt(congressMatch[1]!)
            : undefined;

          // Extract chamber from URL
          const chamberMatch = request.url.match(/\/(house|senate)-bill\//i);
          const chamberValue = chamberMatch
            ? chamberMatch[1]!.charAt(0).toUpperCase() + chamberMatch[1]!.slice(1)
            : billNumber.toLowerCase().startsWith("h.")
              ? "House"
              : "Senate";

          // Extract summary
          let summary = $('.summary, [class*="summary"]').first().text().trim() || undefined;
          if (summary) {
            // Clean up and truncate (summary doesn't have strict DB limit but keep it reasonable)
            summary = summary.split('$(document)')[0]!.trim();
            summary = summary.slice(0, 1000); // Reasonable limit for summary
          }

          // Try to get full text using specific selectors to avoid grabbing garbage
          let fullText: string | undefined;
          const specificSelectors = [".bill-text-content", "#bill-summary", ".legis-body"];
          for (const sel of specificSelectors) {
            const el = $(sel).first();
            if (el.length > 0) {
              fullText = el.text().trim() || undefined;
              break;
            }
          }
          if (!fullText) {
            // Fallback: collect only <p> elements inside .bill-text
            const paragraphs: string[] = [];
            $(".bill-text p").each((_, el) => {
              const txt = $(el).text().trim();
              if (txt) paragraphs.push(txt);
            });
            fullText = paragraphs.length > 0 ? paragraphs.join("\n\n") : undefined;
          }
          if (fullText) {
            // Clean up JavaScript and metadata
            fullText = fullText.split('$(document)')[0]!.trim() || undefined;
          }

          const billData = {
            billNumber,
            title,
            description: summary,
            sponsor,
            status,
            introducedDate,
            congress: congressNum,
            chamber: chamberValue,
            summary,
            fullText,
            url: request.url,
            sourceWebsite: "congress.gov" as const,
          };

          log.info(`Scraped bill from Congress.gov: ${billNumber} - ${title}`);

          // Save to database
          await upsertBill(billData);
        } catch (error) {
          log.error(`Error scraping bill from ${request.url}:`, error);
        }
      }
    },
    maxRequestsPerCrawl: maxRequests,
    requestHandlerTimeoutSecs: 60,
  });

  // Build the URL dynamically from config
  const searchUrl = `https://www.congress.gov/search?q=%7B%22congress%22%3A${congress}%2C%22chamber%22%3A%22${chamber}%22%2C%22type%22%3A%22bills%22%7D&pageSort=documentNumber%3Adesc`;

  // Start with the browse page
  await crawler.run([searchUrl]);

  // Get the bill links from the dataset
  const dataset = await Dataset.open();
  const data = await dataset.getData();
  const billLinksData = data.items.find(
    (item: any) => item.type === "congressBillLinks",
  );

  if (billLinksData && Array.isArray(billLinksData.links)) {
    // Now scrape each bill page
    await crawler.run(billLinksData.links);
  }

  console.log("Congress.gov scraper completed");
  printMetricsSummary("Congress.gov");
}
