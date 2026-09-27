import assert from "node:assert/strict";
import test from "node:test";

import { inQuietHours, nextDeliveryAt } from "./quiet-hours";

const overnight = {
  quietHours: true,
  quietStartMin: 22 * 60,
  quietEndMin: 7 * 60,
  timezone: "America/Los_Angeles",
};

void test("3am Pacific is inside the default overnight window", () => {
  // 10:00 UTC on 19 Sep 2026 is 3:00 AM PDT.
  const at = new Date("2026-09-19T10:00:00.000Z");
  assert.equal(inQuietHours(at, overnight), true);
});

void test("noon Pacific is outside the overnight window", () => {
  const at = new Date("2026-09-19T19:00:00.000Z");
  assert.equal(inQuietHours(at, overnight), false);
});

void test("a quiet-hours delivery waits until the window ends", () => {
  const at = new Date("2026-09-19T10:00:00.000Z");
  const when = nextDeliveryAt(at, overnight);
  assert.equal(inQuietHours(when, overnight), false);
  assert.ok(when.getTime() > at.getTime());
});

void test("quiet hours off delivers immediately", () => {
  const at = new Date("2026-09-19T10:00:00.000Z");
  const when = nextDeliveryAt(at, { ...overnight, quietHours: false });
  assert.equal(when.getTime(), at.getTime());
});
