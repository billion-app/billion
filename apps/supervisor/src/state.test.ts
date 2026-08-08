import assert from "node:assert/strict";
import test from "node:test";

import type { SupervisorState } from "./types.js";
import { seedFirstSeen } from "./state.js";

const now = new Date(2026, 6, 28, 12, 0);

void test("seeding stamps jobs that have no state at all", () => {
  const state: SupervisorState = { jobs: {} };

  assert.equal(seedFirstSeen(state, ["federalregister-weekly"], now), true);
  assert.equal(
    state.jobs["federalregister-weekly"]?.firstSeenAt,
    now.toISOString(),
  );
});

void test("seeding leaves an existing job's history untouched", () => {
  // Backdating `firstSeenAt` onto a job that has already run could make it look
  // due against an occurrence its real last run already covered.
  const lastStartedAt = new Date(2026, 6, 26, 3, 15).toISOString();
  const state: SupervisorState = {
    jobs: {
      "congress-daily": {
        lastStartedAt,
        consecutiveFailures: 0,
        interruptedResumes: 0,
      },
    },
  };

  assert.equal(seedFirstSeen(state, ["congress-daily"], now), false);
  assert.equal(state.jobs["congress-daily"]?.firstSeenAt, undefined);
  assert.equal(state.jobs["congress-daily"]?.lastStartedAt, lastStartedAt);
});

void test("seeding reports no change when every job is already known", () => {
  const state: SupervisorState = { jobs: {} };

  assert.equal(seedFirstSeen(state, ["weekly"], now), true);
  // A restart must not push the reference forward, or a weekly job on a
  // supervisor that restarts more often than weekly would never come due.
  const later = new Date(2026, 6, 29, 12, 0);
  assert.equal(seedFirstSeen(state, ["weekly"], later), false);
  assert.equal(state.jobs["weekly"]?.firstSeenAt, now.toISOString());
});
