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
 *
 * A never-run calendar job measures that from `firstSeenAt` instead. The first
 * version of this compared against `lastStartedAt` alone and returned false
 * when it was absent, which deadlocked: being due required a start, and a start
 * required being due. `federalregister-weekly`, `scc-cvig-weekly` and
 * `ca-sos-weekly` never ran once between the supervisor taking over on
 * 2026-07-28 and 2026-08-07 — ten presidential documents went unscraped, and
 * the only reason `congress-daily` escaped is that someone happened to trigger
 * it by hand on day one, which wrote the `lastStartedAt` it needed.
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

  const reference = lastStartedAt ?? state?.firstSeenAt;
  if (!reference) return false;
  const occurrence = lastOccurrence(job.schedule, now);
  return Date.parse(reference) < occurrence.getTime();
}

/**
 * How many times a job may be auto-resumed after an interruption before the
 * supervisor gives up and waits for a human.
 */
export const MAX_INTERRUPTED_RESUMES = 3;

/**
 * Whether a job was running when the supervisor last stopped existing.
 *
 * `execute` persists `lastStartedAt` before spawning and only writes
 * `lastFinishedAt` afterwards, so a start with no matching finish means the
 * process died mid-run — an OrbStack restart, a host reboot, `kickstart -k`
 * during a deploy.
 */
export function wasInterrupted(state: JobState | undefined): boolean {
  if (!state?.lastStartedAt) return false;
  if (!state.lastFinishedAt) return true;
  return Date.parse(state.lastFinishedAt) < Date.parse(state.lastStartedAt);
}

/**
 * Jobs that were mid-run when the supervisor died and should be picked back up.
 *
 * This exists because a *manual* job could otherwise never resume. Requests
 * arrive as files in `requests/`, and `drainRequests` deletes the file before
 * running so a job that crashes the supervisor cannot re-request itself in a
 * loop. Correct, but it means an interrupted manual job leaves nothing behind
 * that would ever start it again: the supervisor comes back up, finds no
 * request, and sits idle. That silently stalled an 8-hour image backfill and
 * left a 459-brief backlog untouched for eleven hours.
 *
 * Scheduled jobs are excluded — `isDue` already recovers those on its own, and
 * queueing them here as well would double up.
 *
 * The resume is bounded rather than unconditional, which preserves what the
 * delete-first rule was protecting against: a job that takes the supervisor
 * down every time it runs gets `MAX_INTERRUPTED_RESUMES` attempts and then
 * stops, instead of restarting forever.
 */
export function interruptedJobs(
  jobs: readonly JobDefinition[],
  state: Record<string, JobState>,
): QueueEntry[] {
  return jobs
    .filter((job) => job.schedule.kind === "manual")
    .filter((job) => wasInterrupted(state[job.id]))
    .filter(
      (job) =>
        (state[job.id]?.interruptedResumes ?? 0) < MAX_INTERRUPTED_RESUMES,
    )
    .map((job) => ({
      jobId: job.id,
      priority: job.priority,
      reason: "resumed" as const,
    }))
    .sort((a, b) => a.priority - b.priority || a.jobId.localeCompare(b.jobId));
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
