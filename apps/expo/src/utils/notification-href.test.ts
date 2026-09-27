import assert from "node:assert/strict";
import test from "node:test";

import { hrefFromNotificationData } from "./notification-href";

void test("a tap only follows an in-app route", () => {
  assert.equal(
    hrefFromNotificationData({ href: "/article-detail?id=abc" }),
    "/article-detail?id=abc",
  );
  assert.equal(hrefFromNotificationData({ href: "/changes?lens=brief" }), "/changes?lens=brief");
});

void test("external or empty payloads do not navigate", () => {
  assert.equal(hrefFromNotificationData(undefined), undefined);
  assert.equal(hrefFromNotificationData({ href: "https://evil.example" }), undefined);
  assert.equal(hrefFromNotificationData({ href: "//evil.example" }), undefined);
  assert.equal(hrefFromNotificationData({ href: 1 }), undefined);
});
