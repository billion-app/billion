import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./content-images.ts", import.meta.url));

for (const [name, args, error] of [
  [
    "empty targeted repair",
    ["--type", "government_content", "--government-id"],
    /Not enough arguments following: government-id/,
  ],
  [
    "unbounded targeted repair",
    [
      "--type",
      "government_content",
      "--government-id",
      "e7fa2dd3-731c-423b-8d03-c6e977a05397",
      "--drain",
    ],
    /cannot be combined with --drain/,
  ],
  [
    "invalid targeted repair",
    ["--type", "government_content", "--government-id", "invalid"],
    /must contain UUIDs/,
  ],
] as const) {
  test(`${name} fails before selecting or generating images`, () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", script, ...args],
      { encoding: "utf8", timeout: 15_000 },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, error);
  });
}
