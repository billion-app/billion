import type { QueueEntry } from "./types.js";

/**
 * A serial job queue that holds at most one pending entry per job.
 *
 * Deduplication is the point. The supervisor re-evaluates schedules every tick,
 * and a long backfill can span many ticks — without dedup an hour-long job
 * would accumulate an hour's worth of queued copies of itself and then run them
 * all back to back.
 *
 * Serial execution is what replaces the `docker container inspect <other-job>`
 * checks the shell runners each reimplemented: two scrapers cannot overlap
 * because there is only ever one runner.
 */
export class JobQueue {
  #entries: QueueEntry[] = [];

  /** Returns false when the job was already queued. */
  enqueue(entry: QueueEntry): boolean {
    if (this.#entries.some((queued) => queued.jobId === entry.jobId)) {
      return false;
    }
    this.#entries.push(entry);
    this.#entries.sort(
      (a, b) => a.priority - b.priority || a.jobId.localeCompare(b.jobId),
    );
    return true;
  }

  take(): QueueEntry | undefined {
    return this.#entries.shift();
  }

  has(jobId: string): boolean {
    return this.#entries.some((entry) => entry.jobId === jobId);
  }

  get size(): number {
    return this.#entries.length;
  }

  get pending(): readonly QueueEntry[] {
    return [...this.#entries];
  }
}
