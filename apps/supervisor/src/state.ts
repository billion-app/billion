import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";

import type { JobState, SupervisorState } from "./types.js";

const jobStateSchema = z.object({
  firstSeenAt: z.string().optional(),
  lastStartedAt: z.string().optional(),
  lastFinishedAt: z.string().optional(),
  lastExitCode: z.number().optional(),
  consecutiveFailures: z.number().default(0),
  interruptedResumes: z.number().default(0),
});

const supervisorStateSchema = z.object({
  jobs: z.record(z.string(), jobStateSchema).default({}),
});

export const emptyState: SupervisorState = { jobs: {} };

/**
 * Reads persisted job history.
 *
 * A missing or unreadable file yields empty state rather than throwing. The
 * supervisor runs unattended under launchd `KeepAlive`, and refusing to start
 * because a history file is corrupt would turn a cosmetic problem into an
 * outage — losing the history costs at most one redundant run per job.
 */
export async function loadState(path: string): Promise<SupervisorState> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return { jobs: {} };
  }

  try {
    return supervisorStateSchema.parse(JSON.parse(raw));
  } catch {
    return { jobs: {} };
  }
}

/**
 * Writes state via a temporary file and a rename, so a crash mid-write cannot
 * leave a half-written history behind. `rename` is atomic within a filesystem.
 */
export async function saveState(
  path: string,
  state: SupervisorState,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(
    dirname(path),
    `.${Date.now()}-${process.pid}.state.tmp`,
  );
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

/**
 * Stamps `firstSeenAt` on every job that has no state yet, so a newly added
 * calendar job has something for `isDue` to measure its next occurrence
 * against. Returns whether anything changed, so the caller can skip a write.
 *
 * Only jobs with no state at all are touched: a job that has already run keeps
 * `lastStartedAt` as its reference, and backdating a `firstSeenAt` onto it
 * could make it look due when it is not.
 */
export function seedFirstSeen(
  state: SupervisorState,
  jobIds: readonly string[],
  now: Date,
): boolean {
  let changed = false;
  for (const jobId of jobIds) {
    if (state.jobs[jobId]) continue;
    state.jobs[jobId] = {
      firstSeenAt: now.toISOString(),
      consecutiveFailures: 0,
      interruptedResumes: 0,
    };
    changed = true;
  }
  return changed;
}

export function jobStateFor(
  state: SupervisorState,
  jobId: string,
): JobState | undefined {
  return state.jobs[jobId];
}
