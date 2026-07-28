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

/**
 * Reads the per-run budget from the environment.
 *
 * Written out rather than `Number(env) || DEFAULT` because that idiom treats a
 * configured `0` as absent and silently substitutes the default — so an
 * operator asking for "fetch, but generate nothing" got ten generations. Zero
 * is a legitimate budget and has to survive.
 */
export function budgetFromEnv(
  raw: string | undefined = process.env.SCRAPER_MAX_NEW_ITEMS_PER_RUN,
): number {
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_MAX_NEW_ITEMS_PER_RUN;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return DEFAULT_MAX_NEW_ITEMS_PER_RUN;
  }
  return parsed;
}

export function createNewItemLimiter(
  max: number = budgetFromEnv(),
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
