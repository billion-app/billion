import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function assertOtaMain(repository) {
  const git = (args, input) =>
    execFileSync("git", args, {
      cwd: repository,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      input,
      maxBuffer: 128 * 1024 * 1024,
      env: { ...process.env, GIT_NO_REPLACE_OBJECTS: "1" },
    });

  if (git(["rev-parse", "--is-shallow-repository"]).trim() !== "false") {
    throw new Error(
      "Main integration requires full Git history (fetch-depth: 0).",
    );
  }
  const source = git(["rev-parse", "--verify", "HEAD^{commit}"]).trim();
  const main = git([
    "rev-parse",
    "--verify",
    "refs/remotes/origin/main^{commit}",
  ]).trim();
  const base = git(["merge-base", main, source]).trim();
  const commits = git(["rev-list", "--reverse", source, `^${main}`]).trim();
  if (!commits) return { source, main, backports: [] };

  if (git(["rev-list", "--merges", source, `^${main}`]).trim()) {
    throw new Error(
      "OTA source contains merges absent from main. Use linear cherry-picks of merged fixes.",
    );
  }

  const patches = (tip, exclude) => {
    const diff = git([
      "log",
      "--no-merges",
      "--format=medium",
      "-p",
      "--binary",
      "--full-index",
      "--no-renames",
      "--no-ext-diff",
      "--no-textconv",
      tip,
      `^${exclude}`,
      "--",
    ]);
    // Unlike git cherry, preserve whitespace: it can change strings and program behavior.
    const ids = git(["patch-id", "--verbatim"], diff).trim();
    return ids ? ids.split("\n").map((line) => line.split(" ")) : [];
  };
  const mainPatches = new Map(patches(main, base));
  const sourcePatches = new Map(
    patches(source, main).map(([patch, commit]) => [commit, patch]),
  );
  const backports = commits.split("\n").map((commit) => {
    const integrated = mainPatches.get(sourcePatches.get(commit));
    if (!integrated) {
      throw new Error(
        `OTA commit ${commit} has no exact patch on main. Merge it first, then cherry-pick the resulting main commit (including squash merges).`,
      );
    }
    return { source: commit, main: integrated };
  });
  return { source, main, backports };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    if (process.argv.length !== 3)
      throw new Error("Usage: assert-ota-main.mjs SOURCE_DIRECTORY");
    const result = assertOtaMain(process.argv[2]);
    console.log(JSON.stringify(result, null, 2));
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `main=${result.main}\n`);
    }
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        [
          "### OTA main integration verified",
          `- Source: \`${result.source}\``,
          `- Checked main: \`${result.main}\``,
          ...result.backports.map(
            (commit) =>
              `- Backport \`${commit.source}\` matches main commit \`${commit.main}\``,
          ),
          "",
        ].join("\n"),
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
