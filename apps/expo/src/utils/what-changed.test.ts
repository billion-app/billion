import assert from "node:assert/strict";
import test from "node:test";

import type { ChangeItem } from "./what-changed";
import {
  anyMovedSince,
  briefCountLine,
  briefDateLabel,
  changeConnection,
  changeHeadline,
  displayBillNumber,
  movedSummaryLines,
  selectChangeItems,
  toChangeLine,
} from "./what-changed";

const NOW = new Date("2026-09-12T16:00:00.000Z");
const YESTERDAY = new Date("2026-09-11T16:00:00.000Z");
const LAST_WEEK = new Date("2026-09-05T16:00:00.000Z");

const bill = (id: string, extra: Partial<ChangeItem> = {}): ChangeItem => ({
  id,
  type: "bill",
  title: "A measure",
  billNumber: "H.R. 1234",
  billStatus: "Passed House",
  activityAt: NOW,
  jurisdiction: "federal",
  ...extra,
});

void test("state bill numbers drop the session tail", () => {
  assert.equal(displayBillNumber("AB 12 (2025–2026)"), "AB 12");
});

void test("a bill headline is number and status, not the long title", () => {
  assert.equal(changeHeadline(bill("a")), "H.R. 1234 · Passed House");
});

void test("court records keep their title", () => {
  assert.equal(
    changeHeadline({
      id: "c",
      type: "court_case",
      title: "Ninth Circuit stays the order",
    }),
    "Ninth Circuit stays the order",
  );
});

void test("followed records speak as a watch, not a topic guess", () => {
  assert.equal(
    changeConnection(bill("a"), {
      savedIds: new Set(["a"]),
      vectors: ["congress"],
    }),
    "You follow this",
  );
});

void test("an unfollowed federal bill can still name Congress", () => {
  assert.equal(
    changeConnection(bill("a"), {
      savedIds: new Set(),
      vectors: ["congress"],
    }),
    "You watch Congress",
  );
});

void test("state watch uses the place name when we have one", () => {
  assert.equal(
    changeConnection(bill("a", { jurisdiction: "ca" }), {
      savedIds: new Set(),
      vectors: ["state"],
      place: "California",
    }),
    "You watch California",
  );
});

void test("home keeps at most seven records", () => {
  const items = Array.from({ length: 12 }, (_, i) =>
    bill(`id-${i}`, { activityAt: new Date(NOW.getTime() - i * 1000) }),
  );
  assert.equal(selectChangeItems(items, { savedIds: new Set() }).length, 7);
});

void test("a followed record that moved rises above newer unfollowed ones", () => {
  const selected = selectChangeItems(
    [
      bill("new", { activityAt: NOW }),
      bill("watched", { activityAt: YESTERDAY }),
    ],
    {
      savedIds: new Set(["watched"]),
      lastVisitAt: LAST_WEEK,
    },
  );
  assert.equal(selected[0]?.id, "watched");
});

void test("an untouched bookmark does not bury a newer vote", () => {
  const selected = selectChangeItems(
    [
      bill("vote", { activityAt: NOW }),
      bill("watched", { activityAt: LAST_WEEK }),
    ],
    {
      savedIds: new Set(["watched"]),
      lastVisitAt: YESTERDAY,
    },
  );
  assert.equal(selected[0]?.id, "vote");
});

void test("summary counts types and only mentions follows when mixed", () => {
  assert.deepEqual(
    movedSummaryLines(
      [
        bill("a"),
        bill("b"),
        {
          id: "c",
          type: "court_case",
          title: "A ruling",
        },
      ],
      { savedIds: new Set(["a"]) },
    ),
    ["2 bills moved", "1 court ruling", "1 you follow moved"],
  );
});

void test("when every item is followed the type lines are enough", () => {
  assert.deepEqual(
    movedSummaryLines([bill("a"), bill("b")], {
      savedIds: new Set(["a", "b"]),
    }),
    ["2 bills moved"],
  );
});

void test("the count line distinguishes a return from a first look", () => {
  assert.equal(briefCountLine(4, true), "4 things moved while you were away.");
  assert.equal(briefCountLine(5, false), "5 things worth knowing.");
});

void test("movement requires an activity newer than the last visit", () => {
  assert.equal(
    anyMovedSince([bill("a", { activityAt: LAST_WEEK })], YESTERDAY),
    false,
  );
  assert.equal(
    anyMovedSince([bill("a", { activityAt: NOW })], YESTERDAY),
    true,
  );
  assert.equal(anyMovedSince([bill("a")], undefined), false);
});

void test("the brief date is a weekday and a month, not a relative phrase", () => {
  assert.match(briefDateLabel(NOW), /September/);
});

void test("a change line carries why only when the takeaway exists", () => {
  const line = toChangeLine(
    bill("a", { featureTakeaway: "It could change who counts." }),
    { savedIds: new Set(), vectors: ["congress"] },
  );
  assert.equal(line.why, "It could change who counts.");
  assert.equal(line.connection, "You watch Congress");
});
