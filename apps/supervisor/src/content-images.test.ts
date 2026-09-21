import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { JobDefinition, JobState } from "./types.js";
import { jobs } from "./config.js";
import { contentImageFollowUp, producesContent } from "./content-images.js";
import { loadState, saveState } from "./state.js";

const at = (hour: number) => new Date(Date.UTC(2026, 8, 5, hour)).toISOString();
const finished = (hour: number): JobState => ({
  lastStartedAt: at(hour),
  lastFinishedAt: at(hour + 1),
  lastExitCode: 0,
  consecutiveFailures: 0,
  interruptedResumes: 0,
});
const targeted: JobDefinition = {
  ...jobs[0]!,
  id: "open-states-targeted",
  args: [],
  schedule: { kind: "manual" },
  priority: 17,
};
const definitions = [...jobs.filter((j) => j.id !== targeted.id), targeted];

void test("later import batches receive another image pass after restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "billion-image-followup-"));
  try {
    const path = join(dir, "state.json");
    const state = {
      jobs: {
        [targeted.id]: finished(14),
        "content-images-daily": {
          ...finished(12),
          lastSuccessfulStartedAt: at(12),
        },
      },
    };
    await saveState(path, state);
    const restored = await loadState(path);
    assert.equal(
      contentImageFollowUp(definitions, restored.jobs, new Date(at(16)))
        ?.reason,
      "follow-up",
    );
    restored.jobs["content-images-daily"] = {
      ...finished(16),
      lastSuccessfulStartedAt: at(16),
    };
    assert.equal(
      contentImageFollowUp(definitions, restored.jobs, new Date(at(18))),
      undefined,
    );
    restored.jobs[targeted.id] = finished(18);
    assert.ok(
      contentImageFollowUp(definitions, restored.jobs, new Date(at(20))),
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});

void test("partial failures and interrupted imports still need images", () => {
  for (const producer of [
    { ...finished(14), lastExitCode: 1 },
    { ...finished(14), lastFinishedAt: at(13) },
  ]) {
    assert.ok(
      contentImageFollowUp(
        definitions,
        { [targeted.id]: producer },
        new Date(at(16)),
      ),
    );
  }
});

void test("failed image passes retry after backoff even within the same scheduled day", () => {
  const state = {
    [targeted.id]: finished(12),
    "content-images-daily": {
      ...finished(14),
      lastSuccessfulStartedAt: at(10),
      lastExitCode: 1,
      consecutiveFailures: 1,
    },
  };
  assert.equal(
    contentImageFollowUp(definitions, state, new Date(at(15))),
    undefined,
  );
  assert.ok(contentImageFollowUp(definitions, state, new Date(at(16))));
});

void test("legacy successful state covers older imports; failed or interrupted state does not", () => {
  const state = {
    [targeted.id]: finished(10),
    "content-images-daily": finished(12),
  };
  assert.equal(
    contentImageFollowUp(definitions, state, new Date(at(14))),
    undefined,
  );
  state["content-images-daily"].lastFinishedAt = at(11);
  assert.ok(contentImageFollowUp(definitions, state, new Date(at(14))));
});

void test("covers all feed import and repair jobs but excludes civic caches and image jobs", () => {
  for (const id of [
    "congress-daily",
    "open-states-ca-daily",
    "open-states-nc-daily",
    "open-states-tx-daily",
    "legistar-daily",
    "whitehouse-daily",
    "federalregister-daily",
    "reprocess-bare",
    "backfill-descriptions",
    targeted.id,
  ]) {
    assert.equal(
      producesContent(definitions.find((j) => j.id === id)!),
      true,
      id,
    );
  }
  for (const id of [
    "scc-cvig-weekly",
    "ca-sos-weekly",
    "content-images-daily",
    "backfill-content-images",
    "change-images",
    "bill-interest-daily",
    "notify-followers-hourly",
  ]) {
    assert.equal(
      producesContent(definitions.find((j) => j.id === id)!),
      false,
      id,
    );
  }
  assert.equal(
    contentImageFollowUp(definitions, {}, new Date(at(14))),
    undefined,
  );
  for (const id of ["content-images-daily", "backfill-content-images"]) {
    assert.ok(definitions.find((j) => j.id === id)?.args.includes("--drain"));
  }
});
