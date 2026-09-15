import assert from "node:assert/strict";
import { test } from "node:test";

import { monthDay } from "./dates";

void test("calendar dates keep their day west of UTC", () => {
  const prior = process.env.TZ;
  try {
    process.env.TZ = "America/Los_Angeles";
    assert.equal(monthDay("2026-11-03"), "Nov 3");
  } finally {
    if (prior === undefined) delete process.env.TZ;
    else process.env.TZ = prior;
  }
});
