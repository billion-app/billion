import assert from "node:assert/strict";
import test from "node:test";

import { backoffMinutes, dueJobs, isDue, lastOccurrence } from "./schedule.js";
import type { JobDefinition, JobState } from "./types.js";

// 2026-07-26 is a Sunday; 2026-07-28 is a Tuesday. Dates are built with the
// local-time constructor so these assertions hold in any timezone.
const sundayAt = (hour: number, minute: number) =>
  new Date(2026, 6, 26, hour, minute);
const tuesdayNoon = new Date(2026, 6, 28, 12, 0);

const weeklyJob: JobDefinition = {
  id: "weekly",
  description: "weekly",
  script: "main.js",
  args: [],
  schedule: { kind: "weekly", weekday: 0, hour: 3, minute: 15 },
  priority: 0,
  idleTimeoutMinutes: 60,
  maxRuntimeHours: 24,
};

const intervalJob: JobDefinition = {
  id: "backfill",
  description: "backfill",
  script: "main.js",
  args: [],
  schedule: { kind: "interval", everyMinutes: 5 },
  priority: 10,
  idleTimeoutMinutes: 60,
  maxRuntimeHours: 24,
};

const clean: JobState = { consecutiveFailures: 0 };

void test("backoff doubles from 15 minutes and caps at a day", () => {
  assert.equal(backoffMinutes(0), 0);
  assert.equal(backoffMinutes(1), 15);
  assert.equal(backoffMinutes(2), 30);
  assert.equal(backoffMinutes(3), 60);
  assert.equal(backoffMinutes(99), 24 * 60);
});

void test("the weekly occurrence is the most recent one already passed", () => {
  assert.equal(
    lastOccurrence(weeklyJob.schedule as never, tuesdayNoon).getTime(),
    sundayAt(3, 15).getTime(),
  );
});

void test("on the scheduled day but before the time, the occurrence is last week", () => {
  const justBefore = sundayAt(2, 0);
  const occurrence = lastOccurrence(weeklyJob.schedule as never, justBefore);
  assert.equal(occurrence.getTime(), new Date(2026, 6, 19, 3, 15).getTime());
});

void test("the daily occurrence is today once the time has passed", () => {
  assert.equal(
    lastOccurrence({ kind: "daily", hour: 3, minute: 15 }, tuesdayNoon).getTime(),
    new Date(2026, 6, 28, 3, 15).getTime(),
  );
});

void test("before the daily time has come round, the occurrence is yesterday", () => {
  const earlyTuesday = new Date(2026, 6, 28, 1, 0);
  assert.equal(
    lastOccurrence({ kind: "daily", hour: 3, minute: 15 }, earlyTuesday).getTime(),
    new Date(2026, 6, 27, 3, 15).getTime(),
  );
});

void test("a daily job runs once per day, and catches up after an outage", () => {
  const daily: JobDefinition = {
    ...weeklyJob,
    id: "congress-daily",
    schedule: { kind: "daily", hour: 3, minute: 15 },
  };

  // Never run: waits for tonight rather than firing on deploy.
  assert.equal(isDue(daily, undefined, tuesdayNoon), false);

  // Already ran after this morning's occurrence.
  assert.equal(
    isDue(
      daily,
      { ...clean, lastStartedAt: new Date(2026, 6, 28, 3, 16).toISOString() },
      tuesdayNoon,
    ),
    false,
  );

  // Last ran three days ago — the supervisor was down, so catch up now.
  assert.equal(
    isDue(
      daily,
      { ...clean, lastStartedAt: new Date(2026, 6, 25, 3, 15).toISOString() },
      tuesdayNoon,
    ),
    true,
  );
});

void test("a weekly job does not fire the first time the supervisor starts", () => {
  // Deploying on a Tuesday afternoon must not trigger the weekly archive walk.
  assert.equal(isDue(weeklyJob, undefined, tuesdayNoon), false);
});

void test("a weekly job whose last run predates the occurrence is due", () => {
  const state: JobState = {
    ...clean,
    lastStartedAt: new Date(2026, 6, 19, 3, 15).toISOString(),
  };
  assert.equal(isDue(weeklyJob, state, tuesdayNoon), true);
});

void test("a weekly job that already ran this occurrence is not due", () => {
  const state: JobState = { ...clean, lastStartedAt: sundayAt(3, 20).toISOString() };
  assert.equal(isDue(weeklyJob, state, tuesdayNoon), false);
});

void test("an interval job is due immediately when it has never run", () => {
  assert.equal(isDue(intervalJob, undefined, tuesdayNoon), true);
});

void test("an interval job waits out its interval", () => {
  const twoMinutesAgo = new Date(tuesdayNoon.getTime() - 2 * 60_000);
  const state: JobState = { ...clean, lastStartedAt: twoMinutesAgo.toISOString() };
  assert.equal(isDue(intervalJob, state, tuesdayNoon), false);

  const tenMinutesAgo = new Date(tuesdayNoon.getTime() - 10 * 60_000);
  assert.equal(
    isDue(intervalJob, { ...clean, lastStartedAt: tenMinutesAgo.toISOString() }, tuesdayNoon),
    true,
  );
});

void test("backoff suppresses a job that would otherwise be due", () => {
  const oneMinuteAgo = new Date(tuesdayNoon.getTime() - 60_000).toISOString();
  const failing: JobState = {
    consecutiveFailures: 2, // 30 minutes of backoff
    lastStartedAt: new Date(tuesdayNoon.getTime() - 120_000).toISOString(),
    lastFinishedAt: oneMinuteAgo,
  };
  assert.equal(isDue(intervalJob, failing, tuesdayNoon), false);

  // Once the backoff has elapsed the job is offered again. Both timestamps move
  // together: the interval is measured from `lastStartedAt`, so a state where
  // the job finished before it started would not exercise anything real.
  const settled: JobState = {
    consecutiveFailures: 2,
    lastStartedAt: new Date(tuesdayNoon.getTime() - 50 * 60_000).toISOString(),
    lastFinishedAt: new Date(tuesdayNoon.getTime() - 45 * 60_000).toISOString(),
  };
  assert.equal(isDue(intervalJob, settled, tuesdayNoon), true);
});

void test("a manual job is never due on its own", () => {
  const manual: JobDefinition = {
    ...intervalJob,
    id: "manual",
    schedule: { kind: "manual" },
  };
  assert.equal(isDue(manual, undefined, tuesdayNoon), false);
  assert.equal(isDue(manual, clean, tuesdayNoon), false);
});

void test("due jobs come back highest priority first", () => {
  const state = {
    weekly: { ...clean, lastStartedAt: new Date(2026, 6, 19, 3, 15).toISOString() },
  };
  const due = dueJobs([intervalJob, weeklyJob], state, tuesdayNoon);
  assert.deepEqual(
    due.map((entry) => entry.jobId),
    ["weekly", "backfill"],
  );
});
