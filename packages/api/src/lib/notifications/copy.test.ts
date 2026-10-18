import assert from "node:assert/strict";
import test from "node:test";

import {
  followAlertCopy,
  newBillAlertCopy,
  SIGNAL_CATEGORY,
  TEST_ALERT_COPY,
  testAlertCopy,
} from "./copy";
import { expoPushMessage, isExpoPushToken } from "./expo-push";

void test("a follow alert is the event line plus a deep link", () => {
  const copy = followAlertCopy({
    id: "11111111-1111-4111-8111-111111111111",
    title: "Wildfire.",
    billNumber: "CA SB 492",
    status: "Passed Senate",
    actions: [
      {
        date: "2026-09-02",
        text: "Passed/agreed to in Senate.",
        type: "Floor",
      },
    ],
  });
  assert.equal(copy.title, "Wildfire.");
  assert.match(copy.body, /CA SB 492/);
  assert.equal(
    copy.href,
    "/article-detail?id=11111111-1111-4111-8111-111111111111",
  );
  assert.equal(copy.kind, "follow");
});

void test("Expo tokens are the only accepted device credentials", () => {
  assert.equal(isExpoPushToken("ExponentPushToken[abc]"), true);
  assert.equal(isExpoPushToken("ExpoPushToken[abc-1]"), true);
  assert.equal(isExpoPushToken("not-a-token"), false);
  assert.equal(isExpoPushToken("https://evil.example"), false);
});

void test("the push payload uses the signal category and in-app href", () => {
  const message = expoPushMessage({
    to: "ExponentPushToken[abc]",
    title: "Wildfire.",
    body: "CA SB 492 — Passed Senate.",
    href: "/article-detail?id=abc",
    kind: "follow",
  });
  assert.equal(message.categoryId, SIGNAL_CATEGORY);
  assert.equal(message.data.href, "/article-detail?id=abc");
  assert.equal(message.sound, null);
  assert.equal(TEST_ALERT_COPY.href, "/settings/notifications");
});

void test("test notification copy follows the selected language without leaking a previous localized title", () => {
  assert.equal(testAlertCopy("zh").title, "Billion 测试通知");
  assert.equal(testAlertCopy("zh").body, "通知已开启。");
  assert.deepEqual(testAlertCopy("en"), TEST_ALERT_COPY);
  assert.notEqual(testAlertCopy("es").title, TEST_ALERT_COPY.title);
});

void test("new-bill copy identifies the bill and clips long source titles", () => {
  const copy = newBillAlertCopy({
    id: "bill-id",
    title: "a".repeat(100),
    billNumber: "S.5686",
  });
  assert.equal(copy.kind, "new_bill");
  assert.equal(copy.title, "New bill in Congress");
  assert.equal(copy.body, `S.5686: ${"a".repeat(77)}…`);
  assert.equal(copy.href, "/article-detail?id=bill-id");
});
