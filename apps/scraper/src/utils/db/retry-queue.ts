import { and, asc, eq, lte } from "@acme/db";
import { db } from "@acme/db/client";
import { ScraperRetry } from "@acme/db/schema";

import { createLogger } from "../log.js";

const logger = createLogger("retry-queue");

/**
 * Backoff before an item becomes eligible again, by attempt count.
 *
 * Doubling from 15 minutes, capped at a day. The cap matters more than the
 * curve: an item that is broken for a structural reason (a schema the model
 * cannot satisfy, a source that 500s) should keep costing us one attempt a day
 * indefinitely rather than one attempt per run forever. It stays visible in the
 * table either way.
 */
const BASE_DELAY_MS = 15 * 60 * 1000;
const MAX_DELAY_MS = 24 * 60 * 60 * 1000;

/**
 * Attempts after which an item is loud rather than quiet. It is *not* dropped —
 * dropping is the silent-skip behaviour this queue exists to replace — but a
 * dozen failures is a bug to look at, not a transient blip.
 */
const NOISY_AFTER_ATTEMPTS = 12;

export function backoffFor(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  // Guard the shift: 2 ** 40 overflows into Infinity * BASE and produces an
  // invalid Date rather than a clamped one.
  if (exponent > 20) return MAX_DELAY_MS;
  return Math.min(BASE_DELAY_MS * 2 ** exponent, MAX_DELAY_MS);
}

/**
 * Record that an item could not be finished, so the cursor may move past it.
 *
 * Re-recording an existing item increments its attempt count and pushes its
 * next attempt further out. Callers must treat a throw here as a reason to hold
 * the cursor: an unrecorded failure is a lost item.
 */
export async function recordRetry(
  scraperKey: string,
  itemKey: string,
  reason: string,
): Promise<void> {
  // Read-then-write rather than a SQL-side increment: the backoff curve is
  // exponential, which SQL expresses badly, and the attempt count has to be
  // known before the delay can be computed from it. One run processes a given
  // item once, so there is no contention worth a CAS loop here.
  const [existing] = await db
    .select({ attempts: ScraperRetry.attempts })
    .from(ScraperRetry)
    .where(
      and(
        eq(ScraperRetry.scraperKey, scraperKey),
        eq(ScraperRetry.itemKey, itemKey),
      ),
    );

  const attempts = (existing?.attempts ?? 0) + 1;
  const nextAttemptAt = new Date(Date.now() + backoffFor(attempts));

  await db
    .insert(ScraperRetry)
    .values({
      scraperKey,
      itemKey,
      attempts,
      lastReason: reason,
      nextAttemptAt,
    })
    .onConflictDoUpdate({
      target: [ScraperRetry.scraperKey, ScraperRetry.itemKey],
      set: {
        attempts,
        lastReason: reason,
        nextAttemptAt,
        updatedAt: new Date(),
      },
    });

  if (attempts >= NOISY_AFTER_ATTEMPTS) {
    logger.error(
      `${itemKey} has failed ${attempts} times (${reason}) — still queued, but this needs a look`,
    );
  } else {
    logger.info(`${itemKey} queued for retry (attempt ${attempts}: ${reason})`);
  }
}

/** Drop an item from the queue. Safe to call for items that were never in it. */
export async function clearRetry(
  scraperKey: string,
  itemKey: string,
): Promise<void> {
  await db
    .delete(ScraperRetry)
    .where(
      and(
        eq(ScraperRetry.scraperKey, scraperKey),
        eq(ScraperRetry.itemKey, itemKey),
      ),
    );
}

/** Items whose backoff has elapsed, oldest failure first. */
export async function dueRetries(
  scraperKey: string,
  limit: number,
): Promise<{ itemKey: string; attempts: number }[]> {
  if (limit <= 0) return [];
  return db
    .select({ itemKey: ScraperRetry.itemKey, attempts: ScraperRetry.attempts })
    .from(ScraperRetry)
    .where(
      and(
        eq(ScraperRetry.scraperKey, scraperKey),
        lte(ScraperRetry.nextAttemptAt, new Date()),
      ),
    )
    .orderBy(asc(ScraperRetry.firstFailedAt))
    .limit(limit);
}

/** Total outstanding items, due or not — the number worth alerting on. */
export async function retryQueueDepth(scraperKey: string): Promise<number> {
  const rows = await db
    .select({ itemKey: ScraperRetry.itemKey })
    .from(ScraperRetry)
    .where(eq(ScraperRetry.scraperKey, scraperKey));
  return rows.length;
}
