/** How a job decides it is due to run again. */
export type Schedule =
  | {
      /** Fires at a fixed local weekday/time, at most once per occurrence. */
      kind: "weekly";
      /** 0 = Sunday, matching `Date.prototype.getDay`. */
      weekday: number;
      hour: number;
      minute: number;
    }
  | {
      /** Fires at a fixed local time each day, at most once per occurrence. */
      kind: "daily";
      hour: number;
      minute: number;
    }
  | {
      /** Fires when this long has passed since the job last *started*. */
      kind: "interval";
      everyMinutes: number;
    }
  | {
      /** Never fires on its own; only runs when explicitly requested. */
      kind: "manual";
    };

export interface JobDefinition {
  /** Stable identifier. Used in state, logs, and request files. */
  readonly id: string;
  readonly description: string;
  /** Script under the scraper's `dist/`, e.g. `main.js`. */
  readonly script: string;
  readonly args: readonly string[];
  readonly schedule: Schedule;
  /**
   * Extra environment for this job only. Merged over the supervisor's own
   * environment, so a job can raise a budget without the setting leaking into
   * every other job in the container.
   */
  readonly env?: Readonly<Record<string, string>>;
  /**
   * Lower numbers run first when several jobs are due at once. The weekly run
   * outranks the backfills so this week's legislation is never queued behind a
   * multi-hour archive drain.
   */
  readonly priority: number;
  /**
   * How long a job may produce **no output at all** before it is considered
   * wedged and terminated.
   *
   * This is deliberately not a cap on total runtime. A backfill that legitimately
   * runs for fifteen hours is not stuck — it is working — and a wall-clock limit
   * cannot tell the two apart. The first version of this used one, and came
   * within hours of killing a healthy 794-item drain at 78% complete purely
   * because someone (me) guessed "12 hours" before ever running the job.
   *
   * Silence is the honest signal. Every job here narrates per item, so an hour
   * without a single line means something has genuinely hung — a provider call
   * with no timeout of its own, a stalled socket, a deadlock.
   */
  readonly idleTimeoutMinutes: number;

  /**
   * Absolute backstop, in hours. Only exists to catch a job that spins forever
   * while still producing output — a retry loop logging failures would never
   * trip the idle timer. Set generously: this should never be what stops a
   * healthy run.
   */
  readonly maxRuntimeHours: number;
}

export interface JobState {
  lastStartedAt?: string;
  lastFinishedAt?: string;
  lastExitCode?: number;
  /** Drives backoff. Reset to 0 on any successful run. */
  consecutiveFailures: number;
}

export interface SupervisorState {
  jobs: Record<string, JobState>;
}

export interface QueueEntry {
  readonly jobId: string;
  readonly priority: number;
  /** Why this run was queued — surfaced in logs to make history readable. */
  readonly reason: "scheduled" | "requested";
}
