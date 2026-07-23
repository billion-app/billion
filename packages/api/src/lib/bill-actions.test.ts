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
        sourceUrl:
          "https://www.congress.gov/bill/119th-congress/house-bill/1/all-actions",
        sourceLocator: "2026-06-10 · action code Intro-H",
        textKind: "official",
      },
      {
        date: "2026-06-10",
        text: "Introduced in House",
        type: "IntroReferral",
        sourceUrl:
          "https://www.congress.gov/bill/119th-congress/house-bill/1/all-actions",
        sourceLocator: "2026-06-10 · action code Intro-H",
        textKind: "official",
        actionCode: "1000",
      },
    ]),
    [
      {
        date: "2026-06-10",
        text: "Introduced in House",
        type: "IntroReferral",
        sourceUrl:
          "https://www.congress.gov/bill/119th-congress/house-bill/1/all-actions",
        sourceLocator: "2026-06-10 · action code Intro-H",
        textKind: "official",
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
    {
      date: "2026-06-10",
      text: "Passed House",
      type: undefined,
      sourceUrl: undefined,
      sourceLocator: undefined,
      textKind: undefined,
    },
    {
      date: "2026-06-11",
      text: "Passed House",
      type: undefined,
      sourceUrl: undefined,
      sourceLocator: undefined,
      textKind: undefined,
    },
  ]);
});
