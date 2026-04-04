import * as cheerio from "cheerio";

import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import { upsertContent } from "../utils/db/operations.js";
import { printMetricsSummary, resetMetrics } from "../utils/db/metrics.js";
import { getItemLimit } from "../utils/concurrency.js";
import type { Scraper } from "../utils/types.js";

const NAME = "GovTrack";
const logger = createLogger(NAME);

interface GovTrackConfig {
  maxBills?: number;
  congress?: number;
}

async function scrape(config: GovTrackConfig = {}) {
  const { maxBills = 100, congress = 119 } = config;
  logger.info("Starting...");
  resetMetrics();

  const listingUrl = "https://www.govtrack.us/congress/bills/#docket";
  const listingRes = await fetchWithRetry(listingUrl);
  const listingHtml = await listingRes.text();
  const $listing = cheerio.load(listingHtml);

  const collectedLinks: string[] = [];
  $listing('.card > .card-body .card-title > a[href*="/congress/bills/"]').each(
    (_, element) => {
      const href = $listing(element).attr("href");
      if (href && /\/congress\/bills\/\d+\/[a-z]+\d+/.test(href)) {
        const fullUrl = href.startsWith("http")
          ? href
          : `https://www.govtrack.us${href}`;
        if (collectedLinks.length < maxBills) {
          collectedLinks.push(fullUrl);
        }
      }
    },
  );

  logger.info(`Found ${collectedLinks.length} bill links`);

  const textUrls = collectedLinks.slice(0, maxBills).map((url) => `${url}/text`);
  logger.info(`Scraping ${textUrls.length} text pages...`);

  const limit = getItemLimit();
  await Promise.allSettled(
    textUrls.map((textUrl) =>
      limit(async () => {
        try {
          const res = await fetchWithRetry(textUrl, { timeoutMs: 60_000 });
          const html = await res.text();
          const $ = cheerio.load(html);

          $("#main_text_content script, #main_text_content style, #main_text_content nav").remove();
          let fullText = $("#main_text_content").text().trim();

          if (
            /[A-Z]:\\/.test(fullText) ||
            fullText.startsWith("Examples:") ||
            fullText.startsWith("IB ")
          ) {
            logger.warn(`Rejecting garbage text for ${textUrl}`);
            fullText = "";
          }

          if (fullText) {
            const words = fullText.split(/\s+/);
            if (words.length > 1000) {
              fullText = words.slice(0, 1000).join(" ");
            }
          }

          const h1Text = $("#maincontent h1").first().text().trim();
          const h1Parts = h1Text.split(":");
          const billNumber = h1Parts[0]?.trim() || "";
          const title =
            h1Parts.length > 1 ? h1Parts.slice(1).join(":").trim() : h1Text;

          const status = $(".bill-status").first().text().trim() || "Unknown";

          let introducedDate: Date | undefined;
          $("p, div").each((_, element) => {
            const text = $(element).text();
            if (text.includes("Introduced:")) {
              const dateStr = text.replace("Introduced:", "").trim();
              introducedDate = new Date(dateStr);
              return false;
            }
          });

          const congressMatch = textUrl.match(/\/congress\/bills\/(\d+)\//);
          const congressNum = congressMatch
            ? parseInt(congressMatch[1]!)
            : undefined;

          const chamber = billNumber.toLowerCase().startsWith("h.")
            ? "House"
            : "Senate";

          const summary = $(".summary").first().text().trim() || undefined;
          const billUrl = textUrl.replace(/\/text$/, "");

          if (fullText !== "") {
            await upsertContent({
              type: "bill",
              data: {
                billNumber,
                title,
                description: summary,
                sponsor: undefined,
                status,
                introducedDate,
                congress: congressNum,
                chamber,
                summary,
                fullText,
                url: billUrl,
                sourceWebsite: "govtrack" as const,
              },
            });
          }

          logger.success(`Scraped: ${billNumber} — ${title}`);
        } catch (error) {
          logger.error(`Error scraping ${textUrl}`, error);
        }
      }),
    ),
  );

  logger.success("Completed");
  printMetricsSummary(NAME);
}

export const govtrack: Scraper = {
  name: NAME,
  scrape: () => scrape(),
};
