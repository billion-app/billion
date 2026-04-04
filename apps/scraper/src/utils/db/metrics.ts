/**
 * Metrics tracking for scraper runs
 * Tracks API calls, processing stats, and cost savings
 */

import type { ScraperMetrics } from '../types.js';
import { printHeader, printKeyValue, printFooter } from '../log.js';
import { getCostSummary, resetCosts } from '../costs.js';

// Global metrics object for the current run
let currentMetrics: ScraperMetrics = {
  totalProcessed: 0,
  newEntries: 0,
  existingUnchanged: 0,
  existingChanged: 0,
  aiArticlesGenerated: 0,
  imagesSearched: 0,
  videosGenerated: 0,
  videosSkipped: 0,
};

/**
 * Reset metrics for a new scraper run
 */
export function resetMetrics(): void {
  currentMetrics = {
    totalProcessed: 0,
    newEntries: 0,
    existingUnchanged: 0,
    existingChanged: 0,
    aiArticlesGenerated: 0,
    imagesSearched: 0,
    videosGenerated: 0,
    videosSkipped: 0,
  };
  resetCosts();
}

/**
 * Get current metrics snapshot
 * @returns Copy of current metrics
 */
export function getMetrics(): ScraperMetrics {
  return { ...currentMetrics };
}

/**
 * Increment total processed count
 */
export function incrementTotalProcessed(): void {
  currentMetrics.totalProcessed++;
}

/**
 * Increment new entries count
 */
export function incrementNewEntries(): void {
  currentMetrics.newEntries++;
}

/**
 * Increment existing unchanged count
 */
export function incrementExistingUnchanged(): void {
  currentMetrics.existingUnchanged++;
}

/**
 * Increment existing changed count
 */
export function incrementExistingChanged(): void {
  currentMetrics.existingChanged++;
}

/**
 * Increment AI articles generated count
 */
export function incrementAIArticlesGenerated(): void {
  currentMetrics.aiArticlesGenerated++;
}

/**
 * Increment images searched count
 */
export function incrementImagesSearched(): void {
  currentMetrics.imagesSearched++;
}

/**
 * Increment videos generated count
 */
export function incrementVideosGenerated(): void {
  currentMetrics.videosGenerated++;
}

/**
 * Increment videos skipped count
 */
export function incrementVideosSkipped(): void {
  currentMetrics.videosSkipped++;
}

/**
 * Print formatted metrics summary
 * @param scraperName - Name of the scraper (for display)
 */
function formatUsd(amount: number): string {
  return amount < 0.01 && amount > 0
    ? `<$0.01`
    : `$${amount.toFixed(2)}`;
}

export function printMetricsSummary(scraperName: string): void {
  const apiCallsSaved = currentMetrics.existingUnchanged * 4; // 3 OpenAI + 1 Google per unchanged item
  const costs = getCostSummary();

  printHeader(`${scraperName} Results`);
  printKeyValue("Total Processed", currentMetrics.totalProcessed);
  printKeyValue("New Entries", currentMetrics.newEntries);
  printKeyValue("Existing (Unchanged)", currentMetrics.existingUnchanged);
  printKeyValue("Existing (Changed)", currentMetrics.existingChanged);
  printKeyValue("AI Articles Generated", currentMetrics.aiArticlesGenerated);
  printKeyValue("Images Searched", currentMetrics.imagesSearched);
  printKeyValue("Videos Generated", currentMetrics.videosGenerated);
  printKeyValue("Videos Skipped", currentMetrics.videosSkipped);
  printKeyValue("API Calls Saved", `~${apiCallsSaved}`);
  printFooter();

  if (costs.totalCost > 0) {
    printHeader("Estimated Costs");
    if (costs.geminiInputTokens > 0 || costs.geminiOutputTokens > 0) {
      const totalTokens = costs.geminiInputTokens + costs.geminiOutputTokens;
      printKeyValue("Gemini tokens", `${totalTokens.toLocaleString()} (${formatUsd(costs.geminiCost)})`);
    }
    if (costs.dalle3Images > 0) {
      printKeyValue("DALL-E 3 images", `${costs.dalle3Images} (${formatUsd(costs.dalle3Cost)})`);
    }
    if (costs.googleSearches > 0) {
      printKeyValue("Google searches", `${costs.googleSearches} (${formatUsd(costs.googleSearchCost)})`);
    }
    printKeyValue("Total (estimated)", formatUsd(costs.totalCost));
    printFooter();
  }
}
