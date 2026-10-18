import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { assertOtaMain } from "./assert-ota-main.mjs";

function repository(t) {
  const dir = mkdtempSync(join(tmpdir(), "ota-main-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
      },
    }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "OTA test");
  git("config", "user.email", "ota@example.test");
  git("config", "commit.gpgsign", "false");
  const commit = (path, contents) => {
    writeFileSync(join(dir, path), contents);
    git("add", path);
    git("commit", "-m", `Update ${path}`);
    return git("rev-parse", "HEAD");
  };
  const syncMain = () => git("update-ref", "refs/remotes/origin/main", "main");
  const base = commit("app.js", 'export const message = "old";\n');
  syncMain();
  return { dir, git, commit, base, syncMain };
}

test("main tip and historical main source pass", (t) => {
  const r = repository(t);
  const tip = r.commit("native.json", '{"version":2}\n');
  r.syncMain();
  assert.deepEqual(assertOtaMain(r.dir), {
    source: tip,
    main: tip,
    backports: [],
  });
  r.git("checkout", r.base);
  assert.deepEqual(assertOtaMain(r.dir), {
    source: r.base,
    main: tip,
    backports: [],
  });
});

test("unmerged fix fails, then passes after merge into remote main", (t) => {
  const r = repository(t);
  r.git("checkout", "-b", "fix");
  const fix = r.commit("app.js", 'export const message = "fixed";\n');
  assert.throws(() => assertOtaMain(r.dir), /has no exact patch on main/);
  r.git("checkout", "main");
  r.git("merge", "--no-ff", "fix", "-m", "Merge fix");
  r.syncMain();
  r.git("checkout", "fix");
  assert.equal(assertOtaMain(r.dir).source, fix);
  assert.deepEqual(assertOtaMain(r.dir).backports, []);
});

test("multiple exact backports pass and record corresponding main commits", (t) => {
  const r = repository(t);
  r.commit("native.json", '{"version":2}\n');
  const fix = r.commit("app.js", 'export const message = "fixed";\n');
  const other = r.commit("another.js", "export const enabled = true;\n");
  r.syncMain();
  r.git("checkout", "-b", "release", r.base);
  r.git("cherry-pick", fix, other);
  const result = assertOtaMain(r.dir);
  assert.deepEqual(
    result.backports.map((c) => c.main),
    [fix, other],
  );
  assert.notEqual(result.source, other);
  r.commit("extra.js", "unmerged\n");
  assert.throws(() => assertOtaMain(r.dir), /has no exact patch on main/);
});

test("squash-merged fix can be backported using the resulting main commit", (t) => {
  const r = repository(t);
  r.git("checkout", "-b", "feature");
  r.commit("app.js", 'export const message = "part one";\n');
  r.commit("second.js", "part two\n");
  r.git("checkout", "main");
  r.commit("native.json", '{"version":2}\n');
  r.git("merge", "--squash", "feature");
  r.git("commit", "-m", "Squashed fix");
  const squash = r.git("rev-parse", "HEAD");
  r.syncMain();
  r.git("checkout", "feature");
  assert.throws(() => assertOtaMain(r.dir), /has no exact patch on main/);
  r.git("checkout", "-b", "release", r.base);
  r.git("cherry-pick", squash);
  assert.equal(assertOtaMain(r.dir).backports[0].main, squash);
});

test("whitespace changes in string literals do not count as merged patches", (t) => {
  const r = repository(t);
  r.commit("app.js", 'export const message = "a b";\n');
  r.syncMain();
  r.git("checkout", "-b", "release", r.base);
  r.commit("app.js", 'export const message = "ab";\n');
  assert.throws(() => assertOtaMain(r.dir), /has no exact patch on main/);
});

test("binary changes must match main", (t) => {
  const r = repository(t);
  r.commit("native.json", '{"version":2}\n');
  const asset = r.commit("asset.bin", Buffer.from([0, 1, 2, 3]));
  r.syncMain();
  r.git("checkout", "-b", "release", r.base);
  r.git("cherry-pick", asset);
  assert.equal(assertOtaMain(r.dir).backports[0].main, asset);
  r.commit("asset.bin", Buffer.from([0, 1, 2, 4]));
  assert.throws(() => assertOtaMain(r.dir), /has no exact patch on main/);
});

test("branch-only merge commits fail even when their parents are integrated", (t) => {
  const r = repository(t);
  r.git("checkout", "-b", "a");
  r.commit("a.txt", "a\n");
  r.git("checkout", "-b", "b", r.base);
  r.commit("b.txt", "b\n");
  r.git("checkout", "main");
  r.git("merge", "--no-ff", "a", "-m", "A");
  r.git("merge", "--no-ff", "b", "-m", "B");
  r.syncMain();
  r.git("checkout", "-b", "release", "a");
  r.git("merge", "--no-commit", "--no-ff", "b");
  r.commit("app.js", "unreviewed merge resolution\n");
  assert.throws(() => assertOtaMain(r.dir), /merges absent from main/);
});

test("empty branch commits, missing main, and unrelated histories fail closed", (t) => {
  const r = repository(t);
  r.git("checkout", "-b", "empty");
  r.git("commit", "--allow-empty", "-m", "Empty");
  assert.throws(() => assertOtaMain(r.dir), /has no exact patch on main/);
  r.git("checkout", "--orphan", "unrelated");
  r.git("commit", "-m", "Unrelated root");
  assert.throws(() => assertOtaMain(r.dir));
  r.git("update-ref", "-d", "refs/remotes/origin/main");
  assert.throws(() => assertOtaMain(r.dir));
});

test("shallow history fails closed", (t) => {
  const r = repository(t);
  const shallow = join(r.dir, "shallow");
  r.git("clone", "--depth=1", `file://${r.dir}`, shallow);
  assert.throws(() => assertOtaMain(shallow), /full Git history/);
});

test("CLI fails nonzero before merge and writes evidence after merge", (t) => {
  const r = repository(t);
  r.git("checkout", "-b", "fix");
  r.commit("app.js", "fixed\n");
  const output = join(r.dir, "output");
  const summary = join(r.dir, "summary");
  const run = () =>
    spawnSync(
      process.execPath,
      [new URL("./assert-ota-main.mjs", import.meta.url).pathname, r.dir],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_OUTPUT: output,
          GITHUB_STEP_SUMMARY: summary,
        },
      },
    );
  assert.equal(run().status, 1);
  r.git("checkout", "main");
  r.git("merge", "fix");
  r.syncMain();
  assert.equal(run().status, 0);
  assert.match(readFileSync(output, "utf8"), /^main=[0-9a-f]{40}\n$/);
  assert.match(readFileSync(summary, "utf8"), /OTA main integration verified/);
});
