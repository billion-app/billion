/**
 * Caps how many items a single scraper run will generate for.
 *
 * One item draws at most one slot however many assets it produces, and only
 * when something is actually generated — a fully cached item costs nothing.
 *
 * Note this is a cap on *ingestion*, not only on spend. An item that cannot be
 * completed within the budget is not stored at all; it is reported `deferred`
 * so the cursor holds and the next run attempts the whole thing again. Raising
 * or lowering this therefore changes how fast the database keeps up with the
 * source, not just what a run costs.
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
