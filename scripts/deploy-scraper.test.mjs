import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const sha = "a".repeat(40);
const image = `ghcr.io/billion-app/billion-scraper:${sha}`;

async function deploy(capability) {
  const fixture = await mkdtemp(join(tmpdir(), "billion-deploy-test-"));
  try {
    for (const dir of ["bin", "scripts", "deploy/big-mac"])
      await mkdir(join(fixture, dir), { recursive: true });
    for (const file of [
      "scripts/deploy-scraper.mjs",
      "deploy/big-mac/billion-supervisor",
      "deploy/big-mac/com.billion.supervisor.plist",
      "deploy/big-mac/com.billion.translations.plist",
    ]) {
      await copyFile(
        new URL(`../${file}`, import.meta.url),
        join(fixture, file),
      );
    }
    await writeFile(
      join(fixture, "bin/git"),
      `#!${process.execPath}\nconst args=process.argv.slice(2); if(args[0]==='rev-parse')console.log('${sha}');if(args[0]==='log')console.log('test image');\n`,
      { mode: 0o755 },
    );
    const log = join(fixture, "ssh.log");
    await writeFile(
      join(fixture, "bin/ssh"),
      `#!${process.execPath}
const fs = require('node:fs');const script=fs.readFileSync(0,'utf8');
fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(script)+'\\n');
if(script.includes('existsSync'))console.log(${JSON.stringify(capability)});
else if(script.includes('docker ps --filter name=billion-supervisor'))console.log('${image}');
else if(script.includes('docker ps --filter name=^/billion-translations$') && ${capability === "supported"})console.log('${image}');
`,
      { mode: 0o755 },
    );
    const child = spawn(
      process.execPath,
      [join(fixture, "scripts/deploy-scraper.mjs")],
      {
        env: {
          ...process.env,
          PATH: `${join(fixture, "bin")}:${process.env.PATH}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const code = await new Promise((resolve) => child.on("close", resolve));
    const commands = (await readFile(log, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    return { code, output, commands };
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

void test("worker images start and verify both services", async () => {
  const result = await deploy("supported");
  assert.equal(result.code, 0, result.output);
  assert.ok(
    result.commands.some((command) =>
      command.includes('kickstart -k "gui/$(id -u)/com.billion.translations"'),
    ),
  );
  assert.ok(result.output.includes("translations running"));
});

void test("older images disable the worker during rollback", async () => {
  const result = await deploy("absent");
  assert.equal(result.code, 0, result.output);
  assert.ok(
    result.commands.some((command) =>
      command.includes('bootout "gui/$(id -u)/com.billion.translations"'),
    ),
  );
  assert.ok(
    !result.commands.some((command) =>
      command.includes('kickstart -k "gui/$(id -u)/com.billion.translations"'),
    ),
  );
  assert.ok(
    result.commands.some((command) =>
      command.includes(
        'rm -f "$HOME/Library/LaunchAgents/com.billion.translations.plist"',
      ),
    ),
  );
  assert.ok(result.output.includes("disabled (older image)"));
});

void test("an unrecognized capability probe stops before host mutation", async () => {
  const result = await deploy("unexpected");
  assert.equal(result.code, 1);
  assert.ok(
    !result.commands.some((command) => command.includes("deploy.env.tmp")),
  );
  assert.ok(result.output.includes("host pin was not changed"));
});
