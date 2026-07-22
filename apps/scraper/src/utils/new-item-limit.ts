/**
 * Caps how many brand-new items a single scraper run will fully process
 * (AI summary/article/image generation). Items beyond the cap are still
 * saved with their raw content, so they roll over as "backfill" work that
 * a later run will pick up under next day's budget.
 */

export interface NewItemLimiter {
  tryConsume(): boolean;
}

const DEFAULT_MAX_NEW_ITEMS_PER_RUN = 10;

export function createNewItemLimiter(
  max: number = Number(process.env.SCRAPER_MAX_NEW_ITEMS_PER_RUN) ||
    DEFAULT_MAX_NEW_ITEMS_PER_RUN,
): NewItemLimiter {
  let count = 0;
  return {
    tryConsume(): boolean {
      if (count >= max) return false;
      count++;
      return true;
    },
  };
}
