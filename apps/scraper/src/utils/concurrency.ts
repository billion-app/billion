import pLimit from "p-limit";

let itemLimit: ReturnType<typeof pLimit> = pLimit(3);

/**
 * Set the concurrency level for item processing within scrapers.
 * Call this once at startup before any scraper runs.
 */
export function setConcurrency(n: number): void {
  itemLimit = pLimit(n);
}

/**
 * Returns the shared concurrency limiter.
 * Use this to wrap item-processing work in scrapers.
 */
export function getItemLimit(): ReturnType<typeof pLimit> {
  return itemLimit;
}
