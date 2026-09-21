import assert from "node:assert/strict";
import test from "node:test";

import {
  clampMinutes,
  DEFAULT_NOTIFICATION_PREFS,
  formatClock,
  inQuietHours,
  nextDeliveryAt,
  notificationPrefsFromOnboarding,
  parseNotificationPrefs,
  quietHoursLabel,
  stepHour,
} from "./notification-prefs";

void test("missing or corrupt prefs read as the quiet defaults", () => {
  assert.deepEqual(parseNotificationPrefs(null), DEFAULT_NOTIFICATION_PREFS);
  assert.equal(parseNotificationPrefs("{not json").settled, false);
  assert.equal(parseNotificationPrefs(null).brief, false);
  assert.equal(parseNotificationPrefs(null).breaking, true);
});

void test("stored toggles read back without inventing extras", () => {
  const parsed = parseNotificationPrefs(
    JSON.stringify({
      breaking: false,
      following: false,
      brief: true,
      recap: true,
      quietHours: false,
      quietStartMin: 21 * 60,
      quietEndMin: 6 * 60,
      settled: true,
    }),
  );
  assert.equal(parsed.breaking, false);
  assert.equal(parsed.brief, true);
  assert.equal(parsed.quietStartMin, 21 * 60);
  assert.equal(parsed.settled, true);
});

void test("clock labels are 12-hour, not 22:00", () => {
  assert.equal(formatClock(22 * 60), "10:00 PM");
  assert.equal(formatClock(7 * 60), "7:00 AM");
  assert.equal(formatClock(0), "12:00 AM");
  assert.equal(formatClock(12 * 60 + 5), "12:05 PM");
});

void test("the default quiet window is overnight, not same-day", () => {
  const prefs = DEFAULT_NOTIFICATION_PREFS;
  assert.equal(quietHoursLabel(prefs), "10:00 PM \u2013 7:00 AM");
  assert.equal(inQuietHours(new Date(2026, 8, 16, 22, 1), prefs), true);
  assert.equal(inQuietHours(new Date(2026, 8, 16, 3, 0), prefs), true);
  assert.equal(inQuietHours(new Date(2026, 8, 16, 7, 0), prefs), false);
  assert.equal(inQuietHours(new Date(2026, 8, 16, 12, 0), prefs), false);
});

void test("quiet hours off means never quiet", () => {
  assert.equal(
    inQuietHours(new Date(2026, 8, 16, 23, 0), {
      quietHours: false,
      quietStartMin: 22 * 60,
      quietEndMin: 7 * 60,
    }),
    false,
  );
});

void test("a zero-length window is never quiet", () => {
  assert.equal(
    inQuietHours(new Date(2026, 8, 16, 10, 0), {
      quietHours: true,
      quietStartMin: 10 * 60,
      quietEndMin: 10 * 60,
    }),
    false,
  );
});

void test("quiet hours hold delivery until the window ends", () => {
  const prefs = DEFAULT_NOTIFICATION_PREFS;
  const late = new Date(2026, 8, 16, 23, 10);
  const held = nextDeliveryAt(late, prefs);
  assert.equal(held.getDate(), 17);
  assert.equal(held.getHours(), 7);
  assert.equal(held.getMinutes(), 0);
  const afternoon = new Date(2026, 8, 16, 15, 0);
  assert.equal(nextDeliveryAt(afternoon, prefs).getTime(), afternoon.getTime());
});

void test("stepping an hour wraps the day", () => {
  assert.equal(stepHour(23 * 60, 1), 0);
  assert.equal(stepHour(0, -1), 23 * 60);
  assert.equal(clampMinutes(-1), 23 * 60 + 59);
});

void test("fresh launch leaves prefs unsettled until onboarding opt-out", () => {
  const initial = notificationPrefsFromOnboarding(DEFAULT_NOTIFICATION_PREFS, {
    completed: false,
    alerts: { instant: true, digest: true },
  });
  assert.equal(initial.settled, false);
  const completed = notificationPrefsFromOnboarding(initial, {
    completed: true,
    alerts: { instant: false, digest: false },
  });
  assert.equal(completed.following, false);
  assert.equal(completed.recap, false);
  assert.equal(completed.settled, true);
  assert.deepEqual(
    parseNotificationPrefs(JSON.stringify(completed)),
    completed,
  );
});
void test("onboarding initializes opt-in but cannot overwrite later settings", () => {
  const onboarded = notificationPrefsFromOnboarding(
    DEFAULT_NOTIFICATION_PREFS,
    { completed: true, alerts: { instant: true, digest: true } },
  );
  assert.equal(onboarded.following, true);
  assert.equal(onboarded.recap, true);
  const changed = { ...onboarded, following: false };
  assert.equal(
    notificationPrefsFromOnboarding(changed, {
      completed: true,
      alerts: { instant: true, digest: true },
    }).following,
    false,
  );
});
