/* eslint-disable turbo/no-undeclared-env-vars -- Test timezone is restored and is not a build input. */
import assert from "node:assert/strict";
import test from "node:test";

import { daysUntil, formatArticleDate, formatDate, monthDay } from "./dates";

void test("calendar dates retain their day in all UI languages west of UTC", () => {
  const previous = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    for (const locale of ["en-US", "es-US", "zh-CN"]) {
      const date = new Date("2026-11-03T00:00:00Z");
      assert.equal(
        formatArticleDate(new Date("2026-10-15T00:00:00Z"), locale),
        new Intl.DateTimeFormat(locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date("2026-10-15T00:00:00Z")),
      );
      assert.equal(
        formatDate("2026-11-03", locale),
        new Intl.DateTimeFormat(locale, {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(date),
      );
      assert.equal(
        monthDay("2026-11-03", locale),
        new Intl.DateTimeFormat(locale, {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(date),
      );
    }
    assert.equal(monthDay("2026-11-03"), "Nov 3");
    assert.match(monthDay("2026-11-03", "zh-CN"), /11月3日/);
    assert.notEqual(
      formatDate("2026-11-03", "es-US"),
      formatDate("2026-11-03", "en-US"),
    );
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

void test("White House publication dates retain their Eastern calendar day", () => {
  assert.equal(
    formatArticleDate(
      new Date("2026-10-16T00:30:00Z"),
      "en-US",
      "America/New_York",
    ),
    "Oct 15, 2026",
  );
  assert.equal(
    formatArticleDate(new Date("2026-10-15T00:00:00Z")),
    "Oct 15, 2026",
  );
});
