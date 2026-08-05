import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { ConsolaInstance } from "consola";

import type { JobDefinition } from "./types.js";

export interface RunResult {
  readonly exitCode: number;
  readonly timedOut: boolean;
  readonly durationMs: number;
}

export interface RunOptions {
  /** Directory holding the scraper's built entrypoints. */
  readonly scraperDist: string;
  readonly logger: ConsolaInstance;
  /** Resolves when the supervisor is shutting down and the job should stop. */
  readonly signal: AbortSignal;
}

/**
 * Runs one job as a child process and resolves when it exits.
 *
 * Jobs are child processes rather than sibling containers on purpose: the
 * supervisor ships in the same image as the scraper, so it already has the
 * entrypoints on disk. Spawning siblings would mean mounting the Docker socket
 * into the container, which hands every job root on the host for no benefit.
 */
export async function runJob(
  job: JobDefinition,
  options: RunOptions,
): Promise<RunResult> {
  const { scraperDist, logger, signal } = options;
  const startedAt = Date.now();

  const child = spawn(
    process.execPath,
    [`${scraperDist}/${job.script}`, ...job.args],
    {
      env: { ...process.env, ...job.env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let timedOut = false;

  const terminate = (why: string) => {
    timedOut = true;
    logger.error(`[${job.id}] ${why}, terminating`);
    child.kill("SIGTERM");
    // A job that ignores SIGTERM still has to go, or it wedges the queue.
    setTimeout(() => child.kill("SIGKILL"), 30_000).unref();
  };

  // Progress, not elapsed time, is what distinguishes a long job from a stuck
  // one. Every line of output resets the clock, so a run that is working stays
  // alive however long it takes, and one that has genuinely hung is still cut
  // loose rather than blocking the queue behind it forever.
  let idleTimer: NodeJS.Timeout | undefined;
  const noteProgress = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(
      () =>
        terminate(
          `produced no output for ${job.idleTimeoutMinutes}m and looks wedged`,
        ),
      job.idleTimeoutMinutes * 60_000,
    );
  };
  noteProgress();

  // Prefix every line so a shared log stays readable when jobs run back to
  // back, and so grepping for one job's history is possible.
  //
  // Written raw rather than through consola on purpose. The scrapers do their
  // own formatting (`[ai] ℹ …`), and routing their output through a second
  // logger re-decorates each line — turning a single stack trace into a screen
  // of padded blocks. The supervisor's own messages still use consola.
  const pipe = (stream: NodeJS.ReadableStream, sink: NodeJS.WriteStream) => {
    const lines = createInterface({ input: stream });
    lines.on("line", (line) => {
      noteProgress();
      sink.write(`[${job.id}] ${line}\n`);
    });
  };
  if (child.stdout) pipe(child.stdout, process.stdout);
  if (child.stderr) pipe(child.stderr, process.stderr);

  const hardStop = setTimeout(
    () =>
      terminate(
        `exceeded the ${job.maxRuntimeHours}h absolute limit while still producing output`,
      ),
    job.maxRuntimeHours * 3_600_000,
  );

  const onAbort = () => {
    logger.warn(`[${job.id}] supervisor shutting down, terminating job`);
    child.kill("SIGTERM");
  };
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    const exitCode = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signalName) => {
        // A signalled exit has no code; report it the way a shell would so the
        // number in the log means something.
        resolve(code ?? (signalName ? 128 : 1));
      });
    });
    return { exitCode, timedOut, durationMs: Date.now() - startedAt };
  } finally {
    clearTimeout(idleTimer);
    clearTimeout(hardStop);
    signal.removeEventListener("abort", onAbort);
  }
}
