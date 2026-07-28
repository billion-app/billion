/**
 * Caps how many brand-new items a single scraper run will fully process
 * (AI summary/article/image generation). Items beyond the cap are still saved
 * with their raw content — the scraper's incremental cursor advances past
 * everything it fetched, so an item that is not persisted here is lost rather
 * than deferred. They roll over as "backfill" work for the retroactive
 * scripts (`backfill-bill-descriptions`, `retroactive-briefs`, ...).
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
