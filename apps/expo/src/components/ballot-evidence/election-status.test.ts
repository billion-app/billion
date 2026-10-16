import assert from "node:assert/strict";
import { test } from "node:test";

import {
  candidateStatusLabel,
  electionCoverageLabel,
  freshnessLabel,
} from "./election-status";

void test("guide inclusion and declared candidacy do not imply ballot eligibility", () => {
  assert.match(
    candidateStatusLabel(undefined, true),
    /ballot status unverified/,
  );
  assert.match(candidateStatusLabel("declared"), /unknown/);
  assert.match(candidateStatusLabel("onBallot"), /ballot source/);
  assert.match(candidateStatusLabel("withdrewStillOnBallot"), /Withdrawn/);
});
void test("partial and missing coverage explain absence", () => {
  assert.match(electionCoverageLabel("partial"), /may be missing/);
  assert.match(electionCoverageLabel("unknown"), /does not mean/);
  assert.match(
    electionCoverageLabel("statement-guide"),
    /not a complete ballot/,
  );
});
void test("retrieval does not invent review or a freshness budget", () => {
  assert.equal(freshnessLabel({ fetchedAt: "2020-01-01" }), undefined);
  assert.equal(
    freshnessLabel({ fetchedAt: "invalid" }),
    "Retrieval date unavailable",
  );
  assert.match(
    freshnessLabel(
      { fetchedAt: "2020-01-01", staleAfter: "2020-01-02" },
      Date.parse("2020-01-02"),
    ) ?? "",
    /out of date/,
  );
  assert.match(freshnessLabel({ conflicting: true }) ?? "", /disagree/);
});
