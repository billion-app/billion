import assert from "node:assert/strict";
import { test } from "node:test";

import { electionsAreLive } from "./elections-live";

const runtime = globalThis as typeof globalThis & { __DEV__: boolean };

void test("production entry fails closed until server launch approval", () => {
  runtime.__DEV__ = false;
  assert.equal(electionsAreLive(), false);
  assert.equal(electionsAreLive({ lookupEnabled: false }), false);
  assert.equal(electionsAreLive({ lookupEnabled: true }), true);
});

void test("controlled development lookup remains accessible", () => {
  runtime.__DEV__ = true;
  assert.equal(electionsAreLive({ lookupEnabled: false }), true);
});
