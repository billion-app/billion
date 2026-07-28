/**
 * Deploys the scraper supervisor to big-mac.
 *
 * Replaces the previous flow, which was: build an image on the host from
 * whatever happened to be checked out, then hand-edit the `readonly image=`
 * line of four separate runner scripts with `sed`. That is how a build of an
 * unmerged branch ended up running the production backfills.
 *
 * The guarantee this script exists to provide is the ancestry check below: a
 * commit that is not already on `origin/main` cannot be deployed. Images are
 * built and published by CI (which runs the tests first), so the host only ever
 * pulls — it has no build path at all.
 *
 * Usage:
 *   node scripts/deploy-scraper.mjs                 # deploy origin/main
 *   node scripts/deploy-scraper.mjs <sha>           # deploy a specific commit
 *   node scripts/deploy-scraper.mjs --host other    # non-default ssh host
 *   node scripts/deploy-scraper.mjs --dry-run       # check without changing the host
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE_REPO = "ghcr.io/billion-app/billion-scraper";
const LABEL = "com.billion.supervisor";

const args = process.argv.slice(2);
const hostFlag = args.indexOf("--host");
const host = hostFlag === -1 ? "big-mac" : args[hostFlag + 1];
const dryRun = args.includes("--dry-run");
const requested = args.find((arg) => !arg.startsWith("--") && arg !== host);

function git(...gitArgs) {
  return execFileSync("git", gitArgs, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function ssh(script) {
  return execFileSync("ssh", [host, "zsh", "-s"], {
    input: script,
    encoding: "utf8",
  });
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

console.log(`Fetching origin/main…`);
execFileSync("git", ["fetch", "origin", "main", "--quiet"], { cwd: repoRoot });

const sha = git("rev-parse", requested ?? "origin/main");
const subject = git("log", "-1", "--format=%s", sha);

// The whole point of this script. `--is-ancestor` exits non-zero when the
// commit is not reachable from origin/main, which covers unmerged branches,
// local-only commits, and anything rewritten out of history.
try {
  execFileSync("git", ["merge-base", "--is-ancestor", sha, "origin/main"], {
    cwd: repoRoot,
  });
} catch {
  fail(
    `Refusing to deploy ${sha.slice(0, 7)} ("${subject}") — it is not on origin/main.\n` +
      `  Production runs merged, tested code only. Open a PR and land it first.`,
  );
}

const image = `${IMAGE_REPO}:${sha}`;
console.log(`\nDeploying ${sha.slice(0, 7)} — ${subject}`);
console.log(`  image: ${image}`);
console.log(`  host:  ${host}\n`);

// Install the launchd job and wrapper from the repo, so the host never carries
// a hand-edited copy. Both are overwritten on every deploy by design.
const wrapper = readFileSync(
  join(repoRoot, "apps/supervisor/deploy/billion-supervisor"),
  "utf8",
);
const plist = readFileSync(
  join(repoRoot, "apps/supervisor/deploy/com.billion.supervisor.plist"),
  "utf8",
);

if (dryRun) {
  console.log("--dry-run: commit is deployable; stopping before host changes.\n");
  process.exit(0);
}

console.log("Pulling image on host…");
try {
  ssh(`
set -euo pipefail
export PATH="/usr/local/bin:$HOME/.orbstack/bin:/usr/bin:/bin:/usr/sbin:/sbin"
docker pull --quiet ${image}
`);
} catch {
  fail(
    `Could not pull ${image}.\n` +
      `  CI publishes on push to main; check the run for ${sha.slice(0, 7)} has finished.`,
  );
}

console.log("Installing wrapper, plist and image pin…");
ssh(`
set -euo pipefail
mkdir -p "$HOME/.local/bin" "$HOME/.config/billion" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/billion"

cat > "$HOME/.local/bin/billion-supervisor" <<'WRAPPER_EOF'
${wrapper}
WRAPPER_EOF
chmod 755 "$HOME/.local/bin/billion-supervisor"
zsh -n "$HOME/.local/bin/billion-supervisor"

cat > "$HOME/Library/LaunchAgents/${LABEL}.plist" <<'PLIST_EOF'
${plist}
PLIST_EOF

# Written atomically: a half-written pin would leave the supervisor unable to
# start on its next launchd restart.
printf 'SCRAPER_IMAGE=%s\\n' '${image}' > "$HOME/.config/billion/deploy.env.tmp"
mv "$HOME/.config/billion/deploy.env.tmp" "$HOME/.config/billion/deploy.env"
`);

console.log("Restarting supervisor…");
ssh(`
set -euo pipefail
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/${LABEL}.plist" 2>/dev/null || true
launchctl kickstart -k "gui/$(id -u)/${LABEL}"
`);

// Confirm the thing actually came up, rather than reporting success because
// the commands returned zero.
await new Promise((resolve) => setTimeout(resolve, 6000));
const running = ssh(`
export PATH="/usr/local/bin:$HOME/.orbstack/bin:/usr/bin:/bin:/usr/sbin:/sbin"
docker ps --filter name=billion-supervisor --format '{{.Image}}' || true
`).trim();

if (running === image) {
  console.log(`\n✓ Supervisor running on ${host} at ${sha.slice(0, 7)}\n`);
  console.log(`  logs:   ssh ${host} 'tail -f ~/Library/Logs/billion/supervisor.log'`);
  console.log(`  status: ssh ${host} 'cat ~/.local/state/billion/supervisor-state.json'`);
  console.log(`  run a job now: ssh ${host} 'touch ~/.local/state/billion/requests/<job>'\n`);
} else {
  fail(
    `Supervisor did not come up with the expected image.\n` +
      `  saw: ${running || "(no container running)"}\n` +
      `  Check: ssh ${host} 'tail -50 ~/Library/Logs/billion/supervisor.error.log'`,
  );
}
