import type { JobDefinition, JobState, QueueEntry } from "./types.js";
import { backoffMinutes, wasInterrupted } from "./schedule.js";

/** All content imports, including manifest-driven jobs with resolved args. */
export function producesContent(job: JobDefinition): boolean {
  if (job.script === "main.js") {
    return !["scc-cvig", "ca-sos-statements", "ca-regional-measures"].includes(
      job.args[0] ?? "",
    );
  }
  return ["reprocess-content.js", "backfill-bill-descriptions.js"].includes(
    job.script,
  );
}

/** Derive durable work from history, including imports that failed partway. */
export function contentImageFollowUp(
  jobs: readonly JobDefinition[],
  state: Record<string, JobState>,
  now: Date,
): QueueEntry | undefined {
  const imageJob = jobs.find((job) => job.id === "content-images-daily");
  if (!imageJob) return;
  const imageState = state[imageJob.id];
  // Older state files do not have lastSuccessfulStartedAt yet.
  const coveredAt =
    imageState?.lastSuccessfulStartedAt ??
    (imageState?.lastExitCode === 0 && !wasInterrupted(imageState)
      ? imageState.lastStartedAt
      : undefined);
  const pending = jobs.some((job) => {
    const startedAt = state[job.id]?.lastStartedAt;
    return (
      producesContent(job) &&
      startedAt &&
      (!coveredAt || Date.parse(startedAt) >= Date.parse(coveredAt))
    );
  });
  if (!pending) return;
  if (imageState?.consecutiveFailures && imageState.lastFinishedAt) {
    const retryAt =
      Date.parse(imageState.lastFinishedAt) +
      backoffMinutes(imageState.consecutiveFailures) * 60_000;
    if (now.getTime() < retryAt) return;
  }
  return {
    jobId: imageJob.id,
    priority: imageJob.priority,
    reason: "follow-up",
  };
}
