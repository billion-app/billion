import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { jobs } from "./config.js";
import { loadState, saveState } from "./state.js";

void test("the running supervisor dispatches and records a durable image follow-up", async () => {
  const dir = await mkdtemp(join(tmpdir(), "billion-image-dispatch-"));
  const statePath = join(dir, "supervisor-state.json");
  const sourceStarted = new Date(Date.now() - 1000).toISOString();
  await saveState(statePath, {
    jobs: {
      // Keep unrelated first-run interval jobs from importing during this fixture.
      ...Object.fromEntries(
        jobs
          .filter((job) => job.schedule.kind === "interval")
          .map((job) => [
            job.id,
            {
              lastStartedAt: sourceStarted,
              lastFinishedAt: sourceStarted,
              lastExitCode: 0,
              consecutiveFailures: 0,
            },
          ]),
      ),
      "congress-daily": {
        lastStartedAt: sourceStarted,
        lastFinishedAt: sourceStarted,
        lastExitCode: 1,
        consecutiveFailures: 1,
        interruptedResumes: 0,
      },
    },
  });
  // Replace only the expensive image executable. Exercise the actual supervisor
  // loop, subprocess dispatch, success recording, and subsequent idle tick.
  await writeFile(
    join(dir, "content-images.js"),
    'console.log("image fixture completed");\n',
  );
  const child = spawn(
    process.execPath,
    ["--import", "tsx", new URL("./main.ts", import.meta.url).pathname],
    {
      env: {
        ...process.env,
        SUPERVISOR_STATE_DIR: dir,
        SUPERVISOR_SCRAPER_DIST: dir,
        SUPERVISOR_TICK_SECONDS: "0.05",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (data) => {
    output += String(data);
  });
  child.stderr.on("data", (data) => {
    output += String(data);
  });
  const exited = once(child, "exit");
  try {
    const deadline = Date.now() + 10_000;
    let success: string | undefined;
    while (Date.now() < deadline) {
      success = (await loadState(statePath)).jobs["content-images-daily"]
        ?.lastSuccessfulStartedAt;
      if (success) break;
      if (child.exitCode !== null) break;
      await delay(25);
    }
    assert.ok(success, output);
    assert.ok(Date.parse(success) > Date.parse(sourceStarted));
    await delay(150);
    assert.equal(
      (await loadState(statePath)).jobs["content-images-daily"]
        ?.lastSuccessfulStartedAt,
      success,
    );
    assert.match(output, /image fixture completed/);
    assert.match(output, /follow-up/);
  } finally {
    child.kill("SIGTERM");
    await exited;
    await rm(dir, { recursive: true });
  }
});
