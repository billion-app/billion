import assert from "node:assert/strict";
import test from "node:test";

import {
  isLocalDatabaseUrl,
  isPlaceholder,
  parseEnvOutput,
  parseVersion,
  upsertEnvText,
} from "./onboard.mjs";

test("parses tool versions", () => {
  assert.deepEqual(parseVersion("v22.20.0"), [22, 20, 0]);
  assert.deepEqual(parseVersion("10.15.1"), [10, 15, 1]);
  assert.equal(parseVersion("unknown"), null);
});

test("parses quoted dotenv-style output", () => {
  assert.deepEqual(
    parseEnvOutput(
      'POSTGRES_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"\nNODE_ENV=development\n',
    ),
    {
      POSTGRES_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      NODE_ENV: "development",
    },
  );
});

test("updates an env value without touching surrounding entries", () => {
  assert.equal(
    upsertEnvText("A=one\nPOSTGRES_URL=old\nB=two\n", "POSTGRES_URL", "new"),
    'A=one\nPOSTGRES_URL="new"\nB=two\n',
  );
});

test("appends an absent env value", () => {
  assert.equal(
    upsertEnvText("A=one\n", "BETTER_AUTH_SECRET", "secret"),
    'A=one\nBETTER_AUTH_SECRET="secret"\n',
  );
});

test("recognizes template placeholders", () => {
  assert.equal(isPlaceholder("supersecret"), true);
  assert.equal(isPlaceholder("your_api_key_here"), true);
  assert.equal(isPlaceholder("a-real-looking-secret"), false);
});

test("distinguishes local and remote database URLs", () => {
  assert.equal(
    isLocalDatabaseUrl("postgresql://postgres@127.0.0.1:5432/postgres"),
    true,
  );
  assert.equal(
    isLocalDatabaseUrl("postgresql://postgres@localhost:5432/postgres"),
    true,
  );
  assert.equal(
    isLocalDatabaseUrl("postgresql://postgres@db.example.com:5432/postgres"),
    false,
  );
});
