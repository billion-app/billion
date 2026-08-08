import { mkdir, readdir, unlink } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { createConsola } from "consola";

import type { QueueEntry, Schedule, SupervisorState } from "./types.js";
import { findJob, jobs } from "./config.js";
import { JobQueue } from "./queue.js";
import { runJob } from "./run.js";
import {
  backoffMinutes,
  dueJobs,
  interruptedJobs,
  MAX_INTERRUPTED_RESUMES,
  wasInterrupted,
} from "./schedule.js";
import { loadState, saveState, seedFirstSeen } from "./state.js";

const logger = createConsola({ formatOptions: { date: true } });

const stateDir = process.env.SUPERVISOR_STATE_DIR ?? "/var/lib/billion";
const scraperDist = process.env.SUPERVISOR_SCRAPER_DIST ?? "/app/dist";
const statePath = join(stateDir, "supervisor-state.json");
const requestsDir = join(stateDir, "requests");
const tickSeconds = Number(process.env.SUPERVISOR_TICK_SECONDS ?? "30");

const queue = new JobQueue();
const shutdown = new AbortController();
let stopping = false;

/**
 * Ad-hoc runs are requested by dropping a file named after a job into
 * `requests/` — `touch requests/retro-videos`. A directory beats a socket or an
 * HTTP port here: it needs no client, it survives a supervisor restart, and it
 * is trivially inspectable over SSH, which is how this host is actually
 * operated.
 */
async function drainRequests(): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(requestsDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const jobId = basename(entry, extname(entry));
    const path = join(requestsDir, entry);

    if (!findJob(jobId)) {
      logger.error(`Ignoring request for unknown job "${jobId}"`);
      await unlink(path).catch(() => undefined);
      continue;
    }

    // Consume the file before running, so a job that crashes the supervisor
    // cannot be re-requested in a loop by its own leftover request file.
    await unlink(path).catch(() => undefined);

    const job = findJob(jobId);
    if (
      job &&
      queue.enqueue({ jobId, priority: job.priority, reason: "requested" })
    ) {
      logger.info(`Queued "${jobId}" on request`);
    } else {
      logger.info(`"${jobId}" was already queued; request collapsed into it`);
    }
  }
}

async function execute(
  entry: QueueEntry,
  state: SupervisorState,
): Promise<void> {
  const job = findJob(entry.jobId);
  if (!job) return;

  const startedAt = new Date().toISOString();
  const previous = state.jobs[entry.jobId];
  state.jobs[entry.jobId] = {
    ...previous,
    lastStartedAt: startedAt,
    consecutiveFailures: previous?.consecutiveFailures ?? 0,
    // Counted at the point the resumed run actually starts, so the bound holds
    // even if this attempt is killed before it can write a finish.
    interruptedResumes:
      entry.reason === "resumed"
        ? (previous?.interruptedResumes ?? 0) + 1
        : (previous?.interruptedResumes ?? 0),
  };
  // Persist before running: if the host loses power mid-job, the restarted
  // supervisor must see that this job was attempted rather than start it again
  // immediately and stack a second copy on whatever the first one left behind.
  await saveState(statePath, state);

  logger.start(`Running "${job.id}" (${entry.reason}) — ${job.description}`);

  const result = await runJob(job, {
    scraperDist,
    logger,
    signal: shutdown.signal,
  });

  const succeeded = result.exitCode === 0 && !result.timedOut;
  const failures = succeeded ? 0 : (previous?.consecutiveFailures ?? 0) + 1;

  state.jobs[entry.jobId] = {
    lastStartedAt: startedAt,
    lastFinishedAt: new Date().toISOString(),
    lastExitCode: result.exitCode,
    consecutiveFailures: failures,
    // Reaching here at all means the job did not take the supervisor with it,
    // so it has earned a fresh set of resumes.
    interruptedResumes: 0,
  };
  await saveState(statePath, state);

  const minutes = (result.durationMs / 60_000).toFixed(1);
  if (succeeded) {
    logger.success(`"${job.id}" finished in ${minutes}m`);
  } else {
    // Only a scheduled job retries. `isDue` returns false for manual jobs
    // unconditionally, so the backoff never applies to them — printing it
    // anyway claimed a recovery that could not happen, and reading "retry #4 in
    // 120m" is why an idle retro-briefs looked like a job that was waiting its
    // turn rather than one that had stopped for good.
    const recovery =
      job.schedule.kind === "manual"
        ? "manual job — it will not retry on its own; request it again to rerun"
        : `retry #${failures} in ${backoffMinutes(failures)}m`;
    logger.error(
      `"${job.id}" failed (exit ${result.exitCode}${
        result.timedOut ? ", timed out" : ""
      }) after ${minutes}m; ${recovery}`,
    );
  }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describeSchedule(schedule: Schedule): string {
  const at = (hour: number, minute: number) =>
    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  switch (schedule.kind) {
    case "interval":
      return `every ${schedule.everyMinutes}m`;
    case "daily":
      return `daily at ${at(schedule.hour, schedule.minute)}`;
    case "weekly":
      return `${WEEKDAYS[schedule.weekday] ?? schedule.weekday} at ${at(schedule.hour, schedule.minute)}`;
    case "manual":
      return "manual (on request only)";
  }
}

async function main(): Promise<void> {
  await mkdir(requestsDir, { recursive: true });
  const state = await loadState(statePath);

  logger.info(
    `Supervisor starting — ${jobs.length} jobs, state at ${statePath}, ` +
      `scraper dist at ${scraperDist}`,
  );
  for (const job of jobs) {
    logger.info(`  ${job.id} — ${describeSchedule(job.schedule)}`);
  }

  // Give jobs the supervisor has never run a reference point, so their first
  // scheduled occurrence from now on is due. Persisted immediately: if this
  // only lived in memory a restart before the first occurrence would keep
  // pushing the reference forward, and a job on a weekly schedule with a
  // supervisor that restarts more often than weekly would never run.
  if (
    seedFirstSeen(
      state,
      jobs.map((job) => job.id),
      new Date(),
    )
  ) {
    await saveState(statePath, state);
  }

  // A manual job interrupted mid-run has no request file left to restart it, so
  // pick it back up here. Done once at startup rather than every tick: after
  // this the job either runs (rewriting its own state) or has exhausted its
  // resumes, and re-checking each tick would requeue it while it is running.
  for (const entry of interruptedJobs(jobs, state.jobs)) {
    if (queue.enqueue(entry)) {
      const attempt = (state.jobs[entry.jobId]?.interruptedResumes ?? 0) + 1;
      logger.warn(
        `"${entry.jobId}" was interrupted mid-run; resuming ` +
          `(attempt ${attempt}/${MAX_INTERRUPTED_RESUMES})`,
      );
    }
  }
  for (const job of jobs) {
    const jobState = state.jobs[job.id];
    if (
      job.schedule.kind === "manual" &&
      wasInterrupted(jobState) &&
      (jobState?.interruptedResumes ?? 0) >= MAX_INTERRUPTED_RESUMES
    ) {
      logger.error(
        `"${job.id}" has been interrupted ${MAX_INTERRUPTED_RESUMES} times ` +
          `without finishing; not resuming it again. Request it manually once ` +
          `the cause is understood.`,
      );
    }
  }

  while (!stopping) {
    await drainRequests();

    for (const entry of dueJobs(jobs, state.jobs, new Date())) {
      if (queue.enqueue(entry)) {
        logger.info(`Queued "${entry.jobId}" (scheduled)`);
      }
    }

    const next = queue.take();
    if (next) {
      await execute(next, state);
      // Loop straight back round rather than sleeping: a finished job often
      // leaves another one due, and the queue is the only thing serialising us.
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, tickSeconds * 1000));
  }

  logger.info("Supervisor stopped");
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    logger.warn(`Received ${signal}; finishing shutdown`);
    shutdown.abort();
  });
}

await main();
