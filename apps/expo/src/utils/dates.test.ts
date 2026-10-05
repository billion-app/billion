/* eslint-disable turbo/no-undeclared-env-vars -- Tests deliberately set and restore the timezone to verify calendar-date boundaries. */
import assert from "node:assert/strict";
import test from "node:test";

import { daysUntil, formatDate } from "./dates";

test("calendar-only election dates retain their day west of UTC", () => {
  const previous = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    assert.equal(formatDate("2099-11-03"), "Tue, Nov 3");
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("Election Day does not end at UTC midnight in California", (context) => {
  const previous = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  context.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-11-04T01:00:00Z"),
  });
  try {
    assert.equal(daysUntil("2026-11-03"), 0);
    assert.equal(daysUntil("2026-11-04"), 1);
  } finally {
    context.mock.timers.reset();
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
