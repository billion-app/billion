import assert from "node:assert/strict";
import test from "node:test";

import { ballotDisplayText, matchesBallotIdentity } from "./ballot-translation";

void test("ballot overlays bind to the contest, ordered candidates and exact original field", () => {
  const identity = {
    kind: "contest" as const,
    title: "Mayor",
    candidates: ["Alex", "Sam"],
  };
  assert.equal(matchesBallotIdentity(identity, { ...identity }), true);
  assert.equal(
    matchesBallotIdentity(identity, { ...identity, title: "Governor" }),
    false,
  );
  assert.equal(
    matchesBallotIdentity(identity, {
      ...identity,
      candidates: ["Sam", "Alex"],
    }),
    false,
  );
  const overlay = {
    originals: { "ballot.summary": "Old source" },
    translations: { "ballot.summary": "中文" },
  };
  assert.equal(
    ballotDisplayText("Old source", "ballot.summary", overlay),
    "中文",
  );
  assert.equal(
    ballotDisplayText("Revised source", "ballot.summary", overlay),
    "Revised source",
  );
  assert.equal(
    ballotDisplayText("Old source", "ballot.summary", undefined),
    "Old source",
  );
  assert.equal(
    ballotDisplayText(undefined, "ballot.subtitle", undefined),
    undefined,
  );
  assert.equal(
    ballotDisplayText(undefined, "ballot.subtitle", overlay),
    undefined,
  );
});
