import assert from "node:assert/strict";
import test from "node:test";

import {
  deliveryNote,
  FOREGROUND_PRESENTATION,
  presentationFor,
  SIGNAL_CATEGORY,
  SIGNAL_COLOR,
  signalAlertContent,
  TEST_PRESENTATION,
} from "./local-notification";

void test("a test send shows the OS banner even while the app is open", () => {
  assert.equal(FOREGROUND_PRESENTATION.shouldShowBanner, false);
  assert.deepEqual(
    presentationFor({ href: "/changes", test: true }),
    TEST_PRESENTATION,
  );
  assert.equal(TEST_PRESENTATION.shouldShowBanner, true);
  assert.deepEqual(
    presentationFor({ href: "/changes" }),
    FOREGROUND_PRESENTATION,
  );
  assert.deepEqual(
    presentationFor({ href: "/changes", test: "true" }),
    TEST_PRESENTATION,
  );
});

void test("a missing native scheduler explains the rebuild, not a toast", () => {
  assert.match(
    deliveryNote(
      {
        ok: false,
        reason: "unavailable",
        detail: "ExpoNotificationScheduler is not in this binary.",
      },
      { quietEndMin: 7 * 60 },
    ),
    /rebuild/i,
  );
});

void test("a test send tells you to lock before it lands", () => {
  const note = deliveryNote(
    {
      ok: true,
      when: new Date(2026, 8, 16, 12, 0, 2),
      test: true,
    },
    { quietEndMin: 7 * 60 },
  );
  assert.match(note, /Cmd\+L/);
  assert.match(note, /navy/i);
});

void test("a successful send points at the lock screen, not an in-app toast", () => {
  const note = deliveryNote(
    { ok: true, when: new Date(2026, 8, 16, 12, 0) },
    { quietEndMin: 7 * 60 },
  );
  assert.match(note, /lock screen/i);
});

void test("the popup uses the event line, not a second Billion title", () => {
  const content = signalAlertContent({
    title: "Wildfire.",
    body: "CA SB 492 advanced.",
    href: "/article-detail?id=abc",
  });
  assert.equal(content.title, "Wildfire.");
  assert.notEqual(content.title, "Billion");
  assert.equal(content.categoryIdentifier, SIGNAL_CATEGORY);
  assert.doesNotMatch(SIGNAL_CATEGORY, /[:-]/);
  assert.equal(content.interruptionLevel, "active");
  assert.equal(content.sound, false);
  assert.equal(content.color, SIGNAL_COLOR);
  assert.deepEqual(content.data, { href: "/article-detail?id=abc" });
});

void test("the compact banner has no decorative thumbnail", () => {
  const content = signalAlertContent({
    title: "Wildfire.",
    body: "CA SB 492 advanced.",
    href: "/changes",
  });
  assert.equal("attachments" in content, false);
});
