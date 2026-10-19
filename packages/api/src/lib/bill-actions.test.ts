import assert from "node:assert/strict";
import test from "node:test";

import { billIntroductionDate, toBillTimelineActions } from "./bill-actions";
import { projectBillStatus } from "./bill-status";

void test("combines internal Congress actions that represent one visible event", () => {
  assert.deepEqual(
    toBillTimelineActions([
      {
        date: "2026-06-10",
        text: "Introduced in House",
        type: "IntroReferral",
        actionCode: "Intro-H",
      },
      {
        date: "2026-06-10",
        text: "Introduced in House",
        type: "IntroReferral",
        actionCode: "1000",
      },
    ]),
    [
      {
        date: "2026-06-10",
        text: "Introduced in House",
        type: "IntroReferral",
      },
    ],
  );
});

void test("keeps matching action text when it occurs on different dates", () => {
  const actions = [
    { date: "2026-06-10", text: "Passed House", actionCode: "A" },
    { date: "2026-06-11", text: "Passed House", actionCode: "B" },
  ];

  assert.deepEqual(toBillTimelineActions(actions), [
    { date: "2026-06-10", text: "Passed House", type: undefined },
    { date: "2026-06-11", text: "Passed House", type: undefined },
  ]);
});

void test("keeps readable milestones when a stored Congress action omits text", () => {
  const actions = [
    {
      date: "2025-12-04",
      text: "Read twice and referred to the Committee on the Judiciary. (text: CR S8509-8512)",
      type: "IntroReferral",
    },
    { date: "2025-12-04", type: "IntroReferral", actionCode: "Intro-S" },
    {
      date: "2025-12-04",
      text: "Introduced in Senate",
      type: "IntroReferral",
      actionCode: "10000",
    },
  ];
  const original = structuredClone(actions);

  assert.deepEqual(toBillTimelineActions(actions), [
    actions[0],
    { date: "2025-12-04", text: "Introduced in Senate", type: "IntroReferral" },
  ]);
  assert.deepEqual(actions, original);
  assert.equal(
    projectBillStatus({
      billNumber: "S. 3348",
      status: actions[0]?.text,
      actions,
    }),
    "Referred to committee",
  );
});

void test("ignores malformed timeline entries without losing valid events", () => {
  assert.deepEqual(
    toBillTimelineActions([
      null,
      {},
      { date: 123, text: "Introduced" },
      { date: "2026-06-10", text: 123 },
      { date: "2026-06-10", text: "   " },
      { date: "  ", text: "Introduced" },
      { date: "2026-06-10", text: "Introduced" },
    ]),
    [{ date: "2026-06-10", text: "Introduced", type: undefined }],
  );
});

void test("federal introduction dates are source metadata, independent of import time", () => {
  const introducedDate = new Date("2026-10-15T00:00:00Z");
  assert.equal(
    billIntroductionDate({
      jurisdiction: "federal",
      introducedDate,
      actions: [],
    }),
    introducedDate,
  );
});

void test("state provider creation dates are never presented as introductions", () => {
  const input = {
    jurisdiction: "ca",
    introducedDate: new Date("2026-10-17T00:00:00Z"),
    actions: [],
  } satisfies Parameters<typeof billIntroductionDate>[0];
  assert.equal(billIntroductionDate(input), null);
  assert.equal(
    billIntroductionDate({
      ...input,
      actions: [{ date: "2026-10-17", type: "referral-committee" }],
    }),
    null,
  );
  assert.equal(
    billIntroductionDate({
      ...input,
      actions: [{ date: "invalid", type: "introduction" }],
    }),
    null,
  );
  assert.equal(
    billIntroductionDate({
      ...input,
      actions: [
        { date: "2026-10-16", type: "reading-1" },
        { date: "2026-10-15", type: "introduction, reading-1" },
      ],
    })?.toISOString(),
    "2026-10-15T00:00:00.000Z",
  );
});
