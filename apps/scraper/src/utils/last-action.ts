/**
 * The date of a bill's newest legislative action.
 *
 * This is what `Bill.lastActionAt` stores and what every "recent" listing
 * sorts on, so it has one job: answer "when did something actually happen to
 * this bill". The alternatives both failed at that. `Bill.createdAt` is our
 * INSERT clock, so it ranked our ingestion history — a 2025 bill first scraped
 * today outranked a 2026 bill scraped last week. `sourceUpdatedAt` is
 * congress.gov's `updateDate`, which moves on metadata refreshes: 44 bills
 * shared a single timestamp, and S. 2017 read as updated 2026-08-07 when its
 * last real action was 2025-06-10.
 *
 * Undated and unparseable actions are ignored rather than treated as epoch —
 * an action with no date is not evidence of being the newest one. A bill whose
 * actions yield nothing returns undefined and falls back to `introducedDate`
 * at read time.
 */
export function latestActionDate(
  actions: readonly { date?: string }[] | undefined,
): Date | undefined {
  if (!actions?.length) return undefined;

  let newest: number | undefined;
  for (const action of actions) {
    if (!action.date) continue;
    const time = Date.parse(action.date);
    if (Number.isNaN(time)) continue;
    if (newest === undefined || time > newest) newest = time;
  }

  return newest === undefined ? undefined : new Date(newest);
}
