import assert from "node:assert/strict";
import test from "node:test";

import { findJob, jobs } from "./config.js";

void test("job ids are unique", () => {
  const ids = jobs.map((job) => job.id);
  assert.equal(new Set(ids).size, ids.length);
});

void test("every job is reachable by id", () => {
  for (const job of jobs) {
    assert.equal(findJob(job.id)?.id, job.id);
  }
  assert.equal(findJob("no-such-job"), undefined);
});

void test("every supported state has an isolated daily refresh", () => {
  const stateCodes = ["ca", "nc", "tx"];
  for (const stateCode of stateCodes) {
    const job = findJob(`open-states-${stateCode}-daily`);
    assert.ok(job, `${stateCode} has no daily Open States job`);
    assert.deepEqual(job.args, [
      "open-states",
      "--recent",
      "100",
      "--retain",
      "50",
      "--retention-days",
      "90",
      "--concurrency",
      "4",
    ]);
    assert.equal(job.env?.OPEN_STATES_STATES, stateCode);
    assert.equal(job.schedule.kind, "daily");
  }
  assert.equal(findJob("open-states-mo-daily"), undefined);
});

void test("daily Congress refresh applies the editorial retention policy", () => {
  const job = findJob("congress-daily");
  assert.ok(job, "daily Congress job is missing");
  assert.deepEqual(job.args, [
    "congress",
    "--recent",
    "80",
    "--retain",
    "50",
    "--retention-days",
    "90",
    "--concurrency",
    "4",
  ]);
});

void test("bill interest scoring runs before source refreshes", () => {
  const job = findJob("bill-interest-daily");
  assert.ok(job, "daily bill-interest job is missing");
  assert.deepEqual(job.args, ["--limit", "1000", "--concurrency", "4"]);
  assert.deepEqual(job.schedule, { kind: "daily", hour: 2, minute: 0 });
  assert.equal(job.priority, 0);
});

void test("executive actions refresh daily", () => {
  const job = findJob("federalregister-daily");
  assert.ok(job, "daily Federal Register job is missing");
  assert.deepEqual(job.args, ["federalregister", "--concurrency", "2"]);
  assert.deepEqual(job.schedule, { kind: "daily", hour: 1, minute: 30 });
});

void test("San Jose decisions refresh daily through the Legistar scraper", () => {
  const job = findJob("legistar-daily");
  assert.ok(job, "daily Legistar job is missing");
  assert.deepEqual(job.args, ["legistar", "--concurrency", "2"]);
  assert.deepEqual(job.schedule, { kind: "daily", hour: 3, minute: 45 });
});

void test("limits are generous enough not to kill healthy work", () => {
  // The first version of this config used wall-clock timeouts picked by guess,
  // and one of them (12h for a 15.4h backfill) would have killed a healthy run
  // at 78% complete. The idle limit is the safeguard now, so it has to be long
  // enough that ordinary slowness — a large-context generation, a retried
  // image — never looks like a hang.
  for (const job of jobs) {
    assert.ok(
      job.idleTimeoutMinutes >= 30,
      `${job.id}: idle limit ${job.idleTimeoutMinutes}m is short enough to kill slow but healthy work`,
    );
    assert.ok(
      job.maxRuntimeHours >= 12,
      `${job.id}: absolute limit ${job.maxRuntimeHours}h is not a backstop, it is a deadline`,
    );
    // The backstop must not be able to fire before the idle limit does.
    assert.ok(
      job.maxRuntimeHours * 60 > job.idleTimeoutMinutes,
      `${job.id}: absolute limit fires before the idle limit could`,
    );
  }
});

void test("scheduled jobs outrank the manual backfills", () => {
  const scheduled = jobs.filter((job) => job.schedule.kind !== "manual");
  const manual = jobs.filter((job) => job.schedule.kind === "manual");
  const worstScheduled = Math.max(...scheduled.map((job) => job.priority));
  const bestManual = Math.min(...manual.map((job) => job.priority));

  // A multi-hour archive drain must never be able to queue ahead of the day's
  // legislation.
  assert.ok(
    worstScheduled < bestManual,
    "a manual backfill can outrank a scheduled run",
  );
});
