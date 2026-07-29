import assert from "node:assert/strict";
import test from "node:test";

import type { QueueEntry } from "./types.js";
import { JobQueue } from "./queue.js";

const entry = (jobId: string, priority: number): QueueEntry => ({
  jobId,
  priority,
  reason: "scheduled",
});

void test("a job already queued is not queued twice", () => {
  const queue = new JobQueue();
  assert.equal(queue.enqueue(entry("backfill", 10)), true);
  assert.equal(queue.enqueue(entry("backfill", 10)), false);
  assert.equal(queue.size, 1);
});

void test("a long-running job cannot accumulate copies of itself", () => {
  // The supervisor re-evaluates schedules every tick, and an hour-long job
  // spans many ticks. Without dedup it would come back to an hour of queued
  // duplicates and run them all.
  const queue = new JobQueue();
  for (let tick = 0; tick < 120; tick++) {
    queue.enqueue(entry("backfill", 10));
  }
  assert.equal(queue.size, 1);
});

void test("entries come out highest priority first regardless of insert order", () => {
  const queue = new JobQueue();
  queue.enqueue(entry("retro-lenses", 21));
  queue.enqueue(entry("weekly", 0));
  queue.enqueue(entry("backfill", 10));

  assert.equal(queue.take()?.jobId, "weekly");
  assert.equal(queue.take()?.jobId, "backfill");
  assert.equal(queue.take()?.jobId, "retro-lenses");
  assert.equal(queue.take(), undefined);
});

void test("equal priorities break ties deterministically", () => {
  const first = new JobQueue();
  first.enqueue(entry("b", 5));
  first.enqueue(entry("a", 5));

  const second = new JobQueue();
  second.enqueue(entry("a", 5));
  second.enqueue(entry("b", 5));

  assert.equal(first.take()?.jobId, "a");
  assert.equal(second.take()?.jobId, "a");
});

void test("has reports membership without consuming", () => {
  const queue = new JobQueue();
  queue.enqueue(entry("weekly", 0));
  assert.equal(queue.has("weekly"), true);
  assert.equal(queue.size, 1);
  assert.equal(queue.has("missing"), false);
});
