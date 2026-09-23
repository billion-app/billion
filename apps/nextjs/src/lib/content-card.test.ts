import assert from "node:assert/strict";
import test from "node:test";

import {
  presentType,
  relativeActivity,
  toCardItem,
  withoutFeatured,
} from "./content-card";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 22, 12);

void test("relative activity uses the phone's day-level copy", () => {
  assert.equal(relativeActivity(new Date(NOW - 1000), NOW), "today");
  assert.equal(relativeActivity(new Date(NOW - DAY), NOW), "1 day ago");
  assert.equal(relativeActivity(new Date(NOW - 5 * DAY), NOW), "5 days ago");
  assert.equal(relativeActivity(undefined, NOW), undefined);
  assert.equal(relativeActivity(new Date("nope"), NOW), undefined);
});

void test("a state bill tag drops the session and, in scope, keeps the state", () => {
  const item = {
    id: "1",
    title: "Wildfire smoke",
    description: "",
    type: "bill" as const,
    billNumber: "CA AB 12 (2025-2026)",
    jurisdiction: "ca" as const,
    jurisdictionCode: "CA" as const,
    billStatus: "In committee",
  };
  assert.equal(toCardItem(item).tag, "CA AB 12");
  const cross = toCardItem(item, { showJurisdiction: true });
  assert.equal(cross.tag, "AB 12");
  assert.equal(cross.jurisdictionCode, "CA");
  assert.equal(toCardItem(item).status, "In committee");
});

void test("non-bill records get a kind as status and no activity date", () => {
  const card = toCardItem({
    id: "2",
    title: "Order",
    description: "An order",
    type: "government_content",
    activityAt: new Date(NOW),
  });
  assert.equal(card.status, "Executive action");
  assert.equal(card.activityAt, undefined);
  assert.equal(card.typeLabel, "ORDER");
});

void test("unknown types present as a briefing", () => {
  assert.equal(presentType("mystery").label, "NEWS");
  assert.equal(presentType("court_case").label, "CASE");
});

void test("featured bills are not repeated in the list below them", () => {
  assert.deepEqual(
    withoutFeatured([{ id: "a" }, { id: "b" }, { id: "c" }], [{ id: "b" }]),
    [{ id: "a" }, { id: "c" }],
  );
});
