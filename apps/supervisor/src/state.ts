import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";

import type { JobState, SupervisorState } from "./types.js";

const jobStateSchema = z.object({
  lastStartedAt: z.string().optional(),
  lastFinishedAt: z.string().optional(),
  lastExitCode: z.number().optional(),
  consecutiveFailures: z.number().default(0),
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

export function jobStateFor(
  state: SupervisorState,
  jobId: string,
): JobState | undefined {
  return state.jobs[jobId];
}
