import assert from "node:assert/strict";
import { test } from "node:test";

import { comparisonFixture } from "./fixtures";
import { comparisonRows, validateComparison } from "./model";

test("identical topics preserve full roster, withdrawal and unequal evidence", () => {
  const race = comparisonFixture("long");
  assert.deepEqual(validateComparison(race), []);
  const rows = comparisonRows(race, "record");
  assert.equal(rows.length, 8);
  assert.equal(rows[2]?.candidate.ballotStatus, "withdrawn-still-on-ballot");
  assert.equal(rows[0]?.cell.status, "available");
  assert.equal(rows[1]?.cell.status, "missing-evidence");
  assert.equal(
    comparisonRows(race, "questionnaire")[0]?.cell.status,
    "unanswered-questionnaire",
  );
  assert.equal(
    comparisonRows(race, "effects")[0]?.cell.status,
    "unavailable-analysis",
  );
});
test("two-candidate and sparse races stay distinct without inferring agreement", () => {
  assert.equal(
    comparisonRows(comparisonFixture("two"), "priorities").length,
    2,
  );
  assert.ok(
    comparisonRows(comparisonFixture("sparse"), "priorities").every(
      (row) => row.cell.status === "missing-evidence",
    ),
  );
});
test("reject unsupported claims, duplicate identities, and synthetic production evidence", () => {
  const race = comparisonFixture("two");
  race.fixture = false;
  assert.ok(validateComparison(race).includes("Source evidence unavailable"));
  race.fixture = true;
  const [first, second] = race.candidates;
  assert.ok(first && second);
  second.id = first.id;
  race.sources = [];
  assert.ok(validateComparison(race).includes("Candidate identity invalid"));
  assert.ok(validateComparison(race).includes("Claim evidence missing"));
});
test("missing cells remain evidence gaps rather than questionnaire non-response", () => {
  const race = comparisonFixture("two");
  const first = race.candidates[0];
  assert.ok(first);
  first.cells = {};
  assert.equal(
    comparisonRows(race, "questionnaire")[0]?.cell.status,
    "missing-evidence",
  );
  assert.equal(
    comparisonRows(race, "effects")[0]?.cell.status,
    "unavailable-analysis",
  );
});
test("a comparison needs an explicit shared question for every topic", () => {
  const race = comparisonFixture("multi");
  race.questions.priorities = " ";
  assert.ok(validateComparison(race).includes("Shared question missing"));
  Reflect.deleteProperty(race.questions, "record");
  assert.ok(validateComparison(race).includes("Shared question missing"));
});
