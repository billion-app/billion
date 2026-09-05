import assert from "node:assert/strict";
import test from "node:test";

import { findJob } from "./config.js";
import { targetedJob } from "./targeted.js";

const job = findJob("open-states-targeted")!;

void test("targeted imports are finite, session-qualified, deduplicated CLI runs", () => {
  const resolved = targetedJob(job, {
    state: "ca",
    session: "20232024",
    bills: ["SB 1470", "SB 1470", "AB 1"],
  });
  assert.deepEqual(resolved.args, [
    "open-states",
    "--session",
    "20232024",
    "--bill",
    "SB 1470",
    "--bill",
    "AB 1",
  ]);
  assert.equal(resolved.env?.OPEN_STATES_STATES, "ca");
  assert.equal(resolved.schedule.kind, "manual");
});

void test("empty, unbounded and arbitrary-command manifests are rejected", () => {
  for (const manifest of [
    {},
    { state: "ca", session: "20232024", bills: [] },
    { state: "ca", session: "20232024", bills: ["--recent 100"] },
    { state: "ca", session: "20232024", bills: Array(201).fill("SB 1") },
    { state: "ca", session: "20232024", bills: ["SB 1"], script: "other.js" },
    { state: "ca,nc", session: "20232024", bills: ["SB 1"] },
  ])
    assert.throws(() => targetedJob(job, manifest));
});

void test("special sessions retain their upstream identity", () => {
  const resolved = targetedJob(job, {
    state: "ca",
    session: "20232024 Special Session 1",
    bills: ["SB 1"],
  });
  assert.equal(resolved.args[2], "20232024 Special Session 1");
});
