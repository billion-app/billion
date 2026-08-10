import type { UpsertOutcome } from "./db/operations.js";

/**
 * Whether an item's outcome lets the cursor move past it.
 *
 * `deferred` is the one that must not: the item is not in the database in the
 * state we want it, for a reason a later run can fix. `skipped` may, because
 * re-offering the item unchanged would reach the same conclusion — and any real
 * change upstream moves its source timestamp, which puts it back in the feed.
 */
export function advancesCursor(
  outcome: UpsertOutcome,
): outcome is Exclude<UpsertOutcome, { status: "deferred" }> {
  return outcome.status !== "deferred";
}

/**
 * How far the cursor may move given this run's outcomes, in feed order.
 *
 * Only the leading run of clean items counts. The feed is sorted oldest-first,
 * so the first item we could not settle is the true high-water mark: moving
 * past it would strand it exactly the way a wall-clock cursor does. Everything
 * from there on is simply re-offered next run, however many of them happened to
 * succeed.
 */
export function cursorHighWaterMark(
  outcomes: { ok: boolean; sourceUpdatedAt?: Date }[],
): { highWaterMark: Date | undefined; held: number } {
  const firstFailure = outcomes.findIndex((outcome) => !outcome.ok);
  const settled =
    firstFailure === -1 ? outcomes : outcomes.slice(0, firstFailure);
  const highWaterMark = settled.reduce<Date | undefined>(
    (newest, outcome) =>
      outcome.sourceUpdatedAt && (!newest || outcome.sourceUpdatedAt > newest)
        ? outcome.sourceUpdatedAt
        : newest,
    undefined,
  );
  return { highWaterMark, held: outcomes.length - settled.length };
}
