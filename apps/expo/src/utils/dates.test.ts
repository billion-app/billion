/* eslint-disable turbo/no-undeclared-env-vars -- This test sets its own timezone and restores it; TZ is not a build input. */
import assert from "node:assert/strict";
import { test } from "node:test";

import { formatArticleDate, monthDay } from "./dates";

void test("calendar dates keep their day west of UTC", () => {
  const prior = process.env.TZ;
  try {
    process.env.TZ = "America/Los_Angeles";
    assert.equal(monthDay("2026-11-03"), "Nov 3");
    assert.equal(
      formatArticleDate(new Date("2026-10-15T00:00:00Z")),
      "Oct 15, 2026",
    );
  } finally {
    if (prior === undefined) delete process.env.TZ;
    else process.env.TZ = prior;
  }
});
