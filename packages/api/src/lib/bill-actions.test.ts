import assert from "node:assert/strict";
import test from "node:test";

import { toBillTimelineActions } from "./bill-actions";

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
