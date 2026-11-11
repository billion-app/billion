import assert from "node:assert/strict";
import test from "node:test";

import { guideListStamp, resultsReported } from "./guide-list-stamp";

const official = (reportedAt: string, reportingLabel: string) =>
  ({ kind: "official", result: { reportedAt, reportingLabel } }) as const;

void test("the latest reported result stamps the list", () => {
  const stamp = guideListStamp(
    [
      official("2026-11-04T05:00:00.000Z", "40% of precincts reporting"),
      official("2026-11-07T07:00:00.000Z", "100% of precincts reporting"),
      { kind: "none" },
      official("2026-11-06T07:00:00.000Z", "90% of precincts reporting"),
    ],
    "reported",
    false,
  );
  assert.ok(stamp?.results);
  assert.equal(stamp.results.reportedAt, "2026-11-07T07:00:00.000Z");
  assert.equal(stamp.results.reportingLabel, "100% of precincts reporting");
  assert.equal(stamp.polls, undefined);
});

void test("a list with no official result and polls hidden has no stamp", () => {
  assert.equal(
    guideListStamp([{ kind: "none" }, { kind: "poll" }], "reported", false),
    undefined,
  );
  assert.equal(guideListStamp([undefined], "loading", false), undefined);
});

void test("with polls shown, missing polls are stated once for the list", () => {
  assert.deepEqual(
    guideListStamp([{ kind: "none" }, undefined], "reported", true),
    { results: undefined, polls: "none" },
  );
  assert.equal(
    guideListStamp([{ kind: "poll" }, { kind: "none" }], "reported", true)
      ?.polls,
    "other",
  );
  assert.equal(
    guideListStamp([{ kind: "poll" }, { kind: "poll" }], "reported", true),
    undefined,
  );
  assert.equal(
    guideListStamp(
      [official("2026-11-07T07:00:00.000Z", "100%"), { kind: "poll" }],
      "reported",
      true,
    )?.polls,
    undefined,
  );
});

void test("poll status follows the standings request while it is not reported", () => {
  assert.equal(guideListStamp([undefined], "loading", true)?.polls, "loading");
  assert.equal(
    guideListStamp([undefined], "unavailable", true)?.polls,
    "unavailable",
  );
});

void test("any official standing marks the election reported", () => {
  const pending = {
    measures: { "1": { kind: "poll" } },
    candidates: { "governor:A": { kind: "none" } },
    governor: { kind: "poll" },
  };
  assert.equal(resultsReported(undefined), false);
  assert.equal(resultsReported(pending), false);
  assert.equal(
    resultsReported({
      ...pending,
      candidates: { "governor:A": { kind: "official" } },
    }),
    true,
  );
});
