import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const sha = "a".repeat(40);
const oldId = "c".repeat(64);
const image = `ghcr.io/billion-app/billion-scraper:${sha}`;
const baseline = new URL(
  "./scraper-autodeploy-idle.baseline.zsh",
  import.meta.url,
);
const production = new URL(
  "../deploy/big-mac/billion-autodeploy",
  import.meta.url,
);
const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

async function run(options = {}) {
  const fixture = await mkdtemp(join(tmpdir(), "billion-autodeploy-test-"));
  try {
    const checkout = join(fixture, ".local/share/billion/autodeploy");
    const bin = join(fixture, "bin");
    await mkdir(join(checkout, ".git"), { recursive: true });
    await mkdir(join(fixture, ".config/billion"), { recursive: true });
    await mkdir(join(fixture, ".local/bin"), { recursive: true });
    await mkdir(bin);
    const record = join(
      fixture,
      ".local/state/billion/autodeploy-paused-container",
    );
    if (options.receipt) {
      await mkdir(join(fixture, ".local/state/billion"), { recursive: true });
      await writeFile(record, options.receipt + "\n");
    }
    const statePath = join(fixture, "state.json");
    await writeFile(
      statePath,
      JSON.stringify({
        ...options,
        paused: Boolean(options.alreadyStopped),
        events: [],
        currentImage: options.current
          ? image
          : `ghcr.io/billion-app/billion-scraper:${"b".repeat(40)}`,
      }),
    );
    const pin = join(fixture, ".config/billion/deploy.env");
    const oldPin = `SCRAPER_IMAGE=${options.current ? image : `ghcr.io/billion-app/billion-scraper:${"b".repeat(40)}`}\n`;
    await writeFile(pin, oldPin);
    const driver = String.raw`
const fs = require("node:fs");
const vm = require("node:vm");
const cp = require("node:child_process");
const path = require("node:path");
const statePath = process.env.AUTODEPLOY_TEST_STATE;
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const args = process.argv.slice(2);
const command = path.basename(process.argv[1]);
const save = () => fs.writeFileSync(statePath, JSON.stringify(state));
const record = (event) => { state.events.push(event); save(); };
if (command === "git") {
  if (args.includes("rev-parse")) console.log("${sha}");
  if (args.includes("reset")) record("reset");
} else if (command === "node") {
  if (args[0]?.endsWith("billion-deploy-scraper.mjs")) {
    record("deploy");
    if (state.deployFailure) process.exit(1);
    state.currentImage = "${image}";
    state.noContainer = false;
    state.paused = false;
    state.originalRemoved = true;
    fs.writeFileSync(path.join(path.dirname(statePath), ".config/billion/deploy.env"), "SCRAPER_IMAGE=${image}\n");
    save();
  } else {
    const result = cp.spawnSync(${JSON.stringify(process.execPath)}, args, { stdio: "inherit", env: process.env });
    process.exit(result.status ?? 1);
  }
} else if (command === "docker") {
  if (args[0] === "ps") {
    if (state.listFailure) process.exit(1);
    if (args.includes("--all")) {
      if (!state.originalRemoved) console.log("${oldId}");
    } else if (!state.noContainer) console.log(args.includes("{{.ID}}") ? "${oldId}" : state.currentImage);
  }
  else if (args[0] === "pull") { record("pull"); if (state.unpublished) process.exit(1); }
  else if (args[0] === "kill") {
    state.signalTargets = [...(state.signalTargets ?? []), args.at(-1)];
    if (args.includes("--signal=STOP") || args.includes("STOP")) {
      state.paused = true;
      if (state.spawnRace) state.raced = true;
      record("stop");
      if (state.interruptSignal) process.kill(process.ppid, state.interruptSignal);
      if (state.stopFailure) process.exit(1);
    } else if (args.includes("--signal=CONT") || args.includes("CONT")) {
      record("continue");
      if (state.originalRemoved || state.resumeFailure) process.exit(1);
      state.paused = false;
      save();
    } else throw new Error("Unexpected Docker signal");
  }
  else if (args[0] === "inspect") {
    if (state.inspectFailure) process.exit(1);
    console.log(args.some(arg => arg.includes("com.billion.service")) ? (state.foreignContainer ? "another-service" : "supervisor") : "${oldId}");
  }
  else if (args[0] === "exec") {
    const code = args[args.indexOf("-e") + 1];
    const error = (code) => Object.assign(new Error(code), { code });
    const processes = () => ["1", "17", "999", ...(state.active || state.raced ? ["201"] : []), ...(state.manual ? ["202"] : []), ...(state.unknownSibling ? ["203"] : [])];
    const fakeFs = {
      readdirSync(name) {
        if (name === "/proc") return processes();
        throw error("ENOENT");
      },
      readFileSync(name) {
        if (name === "/proc/1/task/1/children") return state.active || state.raced ? "201 " : "";
        if (name === "/proc/1/stat") return "1 (node) S 0";
        if (name === "/proc/1/status") {
          state.confirmationReads = (state.confirmationReads ?? 0) + 1;
          const stopped = state.paused && !state.neverStops && (!state.delayedStop || state.confirmationReads > 2);
          save();
          return "Name:\tnode\nState:\t" + (stopped ? "T (stopped)" : "S (sleeping)") + "\n";
        }
        if (name === "/proc/1/cmdline") return "node\0dist/supervisor.js\0";
        if (name === "/proc/17/cmdline") return "node\0/var/lib/billion/cortese-import/controller.mjs\0";
        if (name === "/proc/17/status") return "State:\tS (sleeping)\nPPid:\t0\n";
        if (name === "/proc/203/cmdline") return "node\0/tmp/manual-research.mjs\0";
        if (name === "/proc/201/cmdline") return "node\0/app/dist/california-research.js\0reconcile\0";
        if (name === "/proc/202/cmdline") {
          if (state.unreadable) throw error("EACCES");
          return "node\0/app/dist/california-research.js\0reconcile\0";
        }
        if (name === "/proc/999/cmdline") return "node\0-e\0guard\0";
        throw error("ENOENT");
      },
    };
    const context = {
      require(name) {
        if (name === "fs" || name === "node:fs") return fakeFs;
        if (name === "path" || name === "node:path") return path;
        throw new Error("Unexpected guard dependency " + name);
      },
      process: {
        pid: 999,
        argv: ["node", args[args.indexOf("-e") + 2]],
        kill() { throw new Error("The scheduler signal must come from host Docker"); },
        exit(status) { throw Object.assign(new Error("guard exit"), { exitStatus: status }); },
      },
      console,
      setTimeout,
    };
    Promise.resolve().then(() => vm.runInNewContext(code, context, { timeout: 1000 })).then(() => {
      save();
      if (context.process.exitCode) process.exit(context.process.exitCode);
    }).catch((error) => {
      save();
      if (typeof error.exitStatus === "number") process.exit(error.exitStatus);
      console.error(error.message);
      process.exit(1);
    });
  } else throw new Error("Unexpected Docker command " + args[0]);
} else throw new Error("Unexpected command " + command);
`;
    for (const command of ["git", "docker", "node"])
      await writeFile(join(bin, command), `#!${process.execPath}\n${driver}`, {
        mode: 0o755,
      });
    let source;
    try {
      source = await readFile(production, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      source = await readFile(baseline, "utf8");
    }
    const script = join(fixture, "autodeploy.zsh");
    source = source
      .replaceAll("$HOME", fixture)
      .replace(
        /^export PATH=.*$/m,
        `export PATH=${shellQuote(`${bin}:${process.env.PATH}`)}`,
      );
    await writeFile(script, source);
    const attempts = [];
    async function launch() {
      const child = spawn("/bin/zsh", [script], {
        env: { ...process.env, AUTODEPLOY_TEST_STATE: statePath },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk;
      });
      child.stderr.on("data", (chunk) => {
        output += chunk;
      });
      const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
      const code = await new Promise((resolve) => child.on("close", resolve));
      clearTimeout(timer);
      const result = {
        code,
        output,
        state: JSON.parse(await readFile(statePath, "utf8")),
        pin: await readFile(pin, "utf8"),
        receipt: await readFile(record, "utf8").catch((error) => {
          if (error.code === "ENOENT") return null;
          throw error;
        }),
        oldPin,
      };
      attempts.push(result);
      return result;
    }
    let result = await launch();
    if (options.finishAndRetry || options.recoverAndRetry) {
      await writeFile(
        statePath,
        JSON.stringify({
          ...result.state,
          active: false,
          spawnRace: false,
          raced: false,
          resumeFailure: false,
          interruptSignal: undefined,
        }),
      );
      await launch();
      result = await launch();
    }
    return { ...result, attempts };
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

test("automatic deployment leaves an active supervisor job and its pin intact", async () => {
  const result = await run({ active: true });
  assert.equal(result.code, 0, result.output);
  assert.ok(!result.state.events.includes("deploy"));
  assert.equal(result.state.paused, false);
  assert.equal(result.pin, result.oldPin);
});

test("manual scraper entrypoints also defer automatic deployment", async () => {
  const result = await run({ manual: true });
  assert.equal(result.code, 0, result.output);
  assert.ok(!result.state.events.includes("deploy"));
  assert.equal(result.state.paused, false);
});

test("an unknown sibling Node process defers automatic deployment", async () => {
  const result = await run({ unknownSibling: true });
  assert.equal(result.code, 0, result.output);
  assert.ok(!result.state.events.includes("deploy"));
  assert.equal(result.state.paused, false);
});

test("a scheduler spawn before the pause defers deployment and resumes scheduling", async () => {
  const result = await run({ spawnRace: true });
  assert.equal(result.code, 0, result.output);
  assert.ok(result.state.events.includes("stop"));
  assert.ok(!result.state.events.includes("deploy"));
  assert.equal(result.state.paused, false);
});

test("an idle supervisor deploys once without mistaking infrastructure for a scraper", async () => {
  const result = await run();
  assert.equal(result.code, 0, result.output);
  assert.equal(result.state.events.filter((x) => x === "deploy").length, 1);
  assert.ok(result.state.events.includes("stop"));
  assert.ok(
    result.state.events.indexOf("stop") < result.state.events.indexOf("deploy"),
  );
  assert.ok(result.state.signalTargets.every((target) => target === oldId));
  assert.equal(result.state.paused, false);
});

test("deployment failure resumes the scheduler", async () => {
  const result = await run({ deployFailure: true });
  assert.equal(result.code, 1, result.output);
  assert.ok(result.state.events.includes("stop"));
  assert.equal(result.state.paused, false);
});

test("unreadable process state fails closed without deploying", async () => {
  const result = await run({ manual: true, unreadable: true });
  assert.notEqual(result.code, 0);
  assert.ok(!result.state.events.includes("deploy"));
  assert.equal(result.state.paused, false);
});

test("the current image and pin do not pause or redeploy", async () => {
  const result = await run({ current: true });
  assert.equal(result.code, 0, result.output);
  assert.deepEqual(result.state.events, []);
});

test("an unpublished image leaves active scheduling unchanged", async () => {
  const result = await run({ unpublished: true });
  assert.equal(result.code, 1, result.output);
  assert.ok(!result.state.events.includes("deploy"));
  assert.ok(!result.state.events.includes("stop"));
  assert.equal(result.state.paused, false);
});

test("a completed job permits one deployment and the next interval is a no-op", async () => {
  const result = await run({ active: true, finishAndRetry: true });
  assert.ok(!result.attempts[0].state.events.includes("deploy"));
  assert.equal(result.attempts[0].pin, result.oldPin);
  assert.equal(result.state.events.filter((x) => x === "deploy").length, 1);
  assert.deepEqual(
    result.attempts[2].state.events,
    result.attempts[1].state.events,
  );
  assert.equal(result.state.paused, false);
});

test("delayed STOP delivery is confirmed before deployment", async () => {
  const result = await run({ delayedStop: true });
  assert.equal(result.code, 0, result.output);
  assert.equal(result.state.events.filter((x) => x === "deploy").length, 1);
  assert.ok(result.state.confirmationReads > 2);
  assert.equal(result.state.paused, false);
});

test("a STOP confirmation failure resumes the captured old container without deploying", async () => {
  const result = await run({ neverStops: true });
  assert.notEqual(result.code, 0);
  assert.ok(!result.state.events.includes("deploy"));
  assert.equal(result.state.paused, false, JSON.stringify(result));
  assert.ok(result.state.signalTargets.every((target) => target === oldId));
});

test("an ambiguous STOP failure still attempts cleanup on the captured container", async () => {
  const result = await run({ stopFailure: true });
  assert.notEqual(result.code, 0);
  assert.ok(result.state.events.includes("stop"));
  assert.ok(!result.state.events.includes("deploy"));
  assert.equal(result.state.paused, false);
});

test("failed cleanup of a still-present old container is reported as a failure", async () => {
  const result = await run({ spawnRace: true, resumeFailure: true });
  assert.equal(result.code, 1, result.output);
  assert.ok(!result.state.events.includes("deploy"));
  assert.ok(result.output.includes("Could not resume the old supervisor"));
  assert.equal(result.state.paused, true);
  assert.equal(result.receipt, `${oldId}\n`);
});

test("the next interval recovers a failed owned CONT before deploying", async () => {
  const result = await run({
    spawnRace: true,
    resumeFailure: true,
    recoverAndRetry: true,
  });
  assert.equal(result.attempts[0].code, 1);
  assert.equal(result.attempts[0].receipt, `${oldId}\n`);
  assert.equal(result.attempts[0].state.paused, true);
  assert.equal(result.code, 0, result.output);
  assert.equal(result.state.events.filter((x) => x === "deploy").length, 1);
  assert.equal(result.state.paused, false);
  assert.equal(result.receipt, null);
});

test("an untrappable interruption leaves an owned pause that the next interval recovers", async () => {
  const result = await run({
    interruptSignal: "SIGKILL",
    recoverAndRetry: true,
  });
  assert.equal(result.attempts[0].code, null);
  assert.equal(result.attempts[0].receipt, `${oldId}\n`);
  assert.equal(result.attempts[0].state.paused, true);
  assert.equal(result.code, 0, result.output);
  assert.equal(result.state.paused, false);
  assert.equal(result.receipt, null);
});

test("owned pause recovery runs before the current-image shortcut", async () => {
  const result = await run({
    current: true,
    alreadyStopped: true,
    receipt: oldId,
  });
  assert.equal(result.code, 0, result.output);
  assert.equal(result.state.paused, false);
  assert.deepEqual(result.state.events, ["continue"]);
  assert.equal(result.receipt, null);
});

test("a removed owned container clears its record without resuming a replacement", async () => {
  const result = await run({
    current: true,
    alreadyStopped: true,
    receipt: oldId,
    originalRemoved: true,
  });
  assert.equal(result.code, 0, result.output);
  assert.equal(result.state.paused, true);
  assert.deepEqual(result.state.events, []);
  assert.equal(result.receipt, null);
});

for (const options of [
  { receipt: "bad-record" },
  { receipt: oldId, foreignContainer: true },
])
  test(`invalid pause ownership is not used for signaling ${JSON.stringify(options)}`, async () => {
    const result = await run(options);
    assert.equal(result.code, 1, result.output);
    assert.ok(!result.state.events.includes("continue"));
    assert.ok(!result.state.events.includes("deploy"));
    assert.equal(result.receipt, `${options.receipt}\n`);
  });

test("an independently stopped supervisor is deferred without releasing its pause", async () => {
  const result = await run({ alreadyStopped: true });
  assert.equal(result.code, 0, result.output);
  assert.ok(!result.state.events.includes("deploy"));
  assert.ok(!result.state.events.includes("continue"));
  assert.equal(result.state.paused, true);
});

test("a positively absent running container permits initial deployment", async () => {
  const result = await run({ noContainer: true });
  assert.equal(result.code, 0, result.output);
  assert.equal(result.state.events.filter((x) => x === "deploy").length, 1);
  assert.ok(!result.state.events.includes("stop"));
});

for (const options of [{ listFailure: true }, { inspectFailure: true }])
  test(`container inspection failure does not imply absence ${JSON.stringify(options)}`, async () => {
    const result = await run(options);
    assert.notEqual(result.code, 0);
    assert.ok(!result.state.events.includes("deploy"));
    assert.ok(!result.state.events.includes("stop"));
  });

for (const [interruptSignal, exitCode] of [
  ["SIGHUP", 129],
  ["SIGINT", 130],
  ["SIGTERM", 143],
])
  test(`${interruptSignal} resumes the old scheduler and exits before deployment`, async () => {
    const result = await run({ interruptSignal });
    assert.equal(result.code, exitCode, result.output);
    assert.ok(result.state.events.includes("stop"));
    assert.ok(!result.state.events.includes("deploy"));
    assert.equal(result.state.paused, false);
  });
