import type { JobDefinition, JobState, QueueEntry, Schedule } from "./types.js";

const MINUTE_MS = 60_000;

/** First retry waits this long; each further failure doubles it. */
const BASE_BACKOFF_MINUTES = 15;
/** A permanently broken job costs one attempt a day, not one per tick. */
const MAX_BACKOFF_MINUTES = 24 * 60;

export function backoffMinutes(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return 0;
  const raw = BASE_BACKOFF_MINUTES * 2 ** (consecutiveFailures - 1);
  return Math.min(raw, MAX_BACKOFF_MINUTES);
}

/**
 * The most recent moment matching a calendar schedule at or before `now`, in
 * local time. Local rather than UTC because these times are chosen to land
 * overnight for a human; keeping the same frame stops the run drifting an hour
 * across a DST boundary.
 */
export function lastOccurrence(
  schedule: Extract<Schedule, { kind: "daily" | "weekly" }>,
  now: Date,
): Date {
  const candidate = new Date(now);
  candidate.setHours(schedule.hour, schedule.minute, 0, 0);

  if (schedule.kind === "daily") {
    // Today's occurrence, unless the time has not come round yet.
    if (candidate.getTime() > now.getTime()) {
      candidate.setDate(candidate.getDate() - 1);
    }
    return candidate;
  }

  // Walk back to the scheduled weekday, then back one more week if that lands
  // in the future (i.e. today is the right weekday but the time has not come).
  const dayDelta = (candidate.getDay() - schedule.weekday + 7) % 7;
  candidate.setDate(candidate.getDate() - dayDelta);
  if (candidate.getTime() > now.getTime()) {
    candidate.setDate(candidate.getDate() - 7);
  }
  return candidate;
}

/**
 * Whether a job should run now.
 *
 * A job that has never run is due immediately if it is interval-based, and is
 * *not* due if it is on a calendar schedule: a deploy at 4pm should not trigger
 * the overnight run, but it should leave tonight's intact. A calendar job whose
 * last run predates the most recent occurrence is due, so an outage over the
 * scheduled time is caught up rather than skipped.
 */
export function isDue(
  job: JobDefinition,
  state: JobState | undefined,
  now: Date,
): boolean {
  if (job.schedule.kind === "manual") return false;

  const failures = state?.consecutiveFailures ?? 0;
  if (failures > 0 && state?.lastFinishedAt) {
    const waitMs = backoffMinutes(failures) * MINUTE_MS;
    const readyAt = Date.parse(state.lastFinishedAt) + waitMs;
    if (now.getTime() < readyAt) return false;
  }

  const lastStartedAt = state?.lastStartedAt;

  if (job.schedule.kind === "interval") {
    if (!lastStartedAt) return true;
    const elapsed = now.getTime() - Date.parse(lastStartedAt);
    return elapsed >= job.schedule.everyMinutes * MINUTE_MS;
  }

  if (!lastStartedAt) return false;
  const occurrence = lastOccurrence(job.schedule, now);
  return Date.parse(lastStartedAt) < occurrence.getTime();
}

/**
 * Every job due right now, highest priority first. Ties break on job id so the
 * order is deterministic and logs from two runs can be compared.
 */
export function dueJobs(
  jobs: readonly JobDefinition[],
  state: Record<string, JobState>,
  now: Date,
): QueueEntry[] {
  return jobs
    .filter((job) => isDue(job, state[job.id], now))
    .map((job) => ({
      jobId: job.id,
      priority: job.priority,
      reason: "scheduled" as const,
    }))
    .sort((a, b) => a.priority - b.priority || a.jobId.localeCompare(b.jobId));
}
