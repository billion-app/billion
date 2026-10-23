import assert from "node:assert/strict";
import test from "node:test";

import {
  localDecisionChange,
  projectLocalDecisionState,
} from "./local-decisions";

const followedAt = new Date("2026-10-21T12:00:00Z");
const now = new Date("2026-10-22T12:00:00Z");
const source = {
  id: "one",
  startsAt: new Date("2026-10-25T12:00:00Z"),
  cancelled: false,
  actionName: null,
  passedFlagName: null,
  tally: null,
};
const state = projectLocalDecisionState([source]);

void test("local follow projections are sorted, normalized and exclude source timestamp churn", () => {
  assert.deepEqual(
    projectLocalDecisionState([
      {
        ...source,
        id: "z",
        actionName: " Approved ",
        passedFlagName: " Pass ",
        tally: " 7-0 ",
      },
      { ...source, id: "a", actionName: " " },
    ]),
    [
      {
        id: "a",
        startsAt: source.startsAt.toISOString(),
        cancelled: false,
        outcome: null,
      },
      {
        id: "z",
        startsAt: source.startsAt.toISOString(),
        cancelled: false,
        outcome: { action: "Approved", passed: "Pass", tally: "7-0" },
      },
    ],
  );
  assert.equal(
    localDecisionChange(
      state,
      projectLocalDecisionState([source]),
      now,
      followedAt,
    ),
    null,
  );
  assert.equal(localDecisionChange(null, state, now, followedAt), null);
  assert.equal(localDecisionChange(state, [], now, followedAt), null);
});

void test("local follows alert on future schedule changes and explicit cancellation", () => {
  assert.equal(localDecisionChange([], state, now, followedAt), "schedule");
  assert.equal(
    localDecisionChange(
      state,
      projectLocalDecisionState([
        { ...source, startsAt: new Date("2026-10-26") },
      ]),
      now,
      followedAt,
    ),
    "schedule",
  );
  assert.equal(
    localDecisionChange(
      state,
      projectLocalDecisionState([{ ...source, cancelled: true }]),
      now,
      followedAt,
    ),
    "cancelled",
  );
  assert.equal(
    localDecisionChange(
      [],
      projectLocalDecisionState([{ ...source, cancelled: true }]),
      now,
      followedAt,
    ),
    null,
  );
  assert.equal(
    localDecisionChange(
      [],
      projectLocalDecisionState([
        { ...source, startsAt: new Date("2020-01-01"), actionName: "Approved" },
      ]),
      now,
      followedAt,
    ),
    null,
  );
});

void test("published and corrected structured outcomes alert, missing data and archive do not", () => {
  const past = { ...source, startsAt: new Date("2026-10-01") };
  const approved = projectLocalDecisionState([
    { ...past, actionName: "Approved" },
  ]);
  assert.equal(
    localDecisionChange(
      projectLocalDecisionState([past]),
      approved,
      now,
      followedAt,
    ),
    "outcome",
  );
  assert.equal(
    localDecisionChange(
      approved,
      projectLocalDecisionState([
        { ...past, actionName: "Approved", tally: "7-0" },
      ]),
      now,
      followedAt,
    ),
    "outcome",
  );
  assert.equal(
    localDecisionChange(
      approved,
      projectLocalDecisionState([past]),
      now,
      followedAt,
    ),
    null,
  );
  assert.equal(localDecisionChange([], approved, now, followedAt), null);
});

void test("database JSONB key order cannot turn an unchanged outcome into an alert", () => {
  const previous = [
    {
      id: "one",
      startsAt: source.startsAt.toISOString(),
      cancelled: false,
      outcome: { tally: "7-0", passed: "Pass", action: "Approved" },
    },
  ];
  const current = projectLocalDecisionState([
    { ...source, actionName: "Approved", passedFlagName: "Pass", tally: "7-0" },
  ]);
  assert.equal(localDecisionChange(previous, current, now, followedAt), null);
});

void test("late ingested outcomes alert only for meetings since this follow began", () => {
  const recent = projectLocalDecisionState([
    {
      ...source,
      startsAt: new Date("2026-10-22T10:00:00Z"),
      actionName: "Approved",
    },
  ]);
  assert.equal(localDecisionChange([], recent, now, followedAt), "outcome");
  assert.equal(localDecisionChange([], recent, now, now), null);
});
