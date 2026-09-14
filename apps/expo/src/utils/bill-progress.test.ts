import assert from "node:assert/strict";
import test from "node:test";

import {
  billProgressFromStatus,
  stageIsReached,
  stagesFor,
} from "./bill-progress";

void test("federal bills name the President as the last stop", () => {
  assert.deepEqual(
    stagesFor("federal").map((stage) => stage.label),
    ["Committee", "House", "Senate", "President"],
  );
});

void test("state bills name the Governor as the last stop", () => {
  assert.equal(stagesFor("ca").at(-1)?.label, "Governor");
});

void test("an empty status parks on Committee and fills nothing", () => {
  const progress = billProgressFromStatus(undefined);
  assert.deepEqual(progress.reached, []);
  assert.equal(progress.current, "committee");
});

void test("proposed does not invent committee passage", () => {
  const progress = billProgressFromStatus("Proposed");
  assert.deepEqual(progress.reached, []);
  assert.equal(progress.current, "committee");
});

void test("passed committee fills only that stop", () => {
  const progress = billProgressFromStatus("Passed committee");
  assert.deepEqual(progress.reached, ["committee"]);
  assert.equal(progress.current, "house");
});

void test("passed House does not claim the Senate", () => {
  const progress = billProgressFromStatus("Passed House");
  assert.ok(stageIsReached(progress, "house"));
  assert.ok(!stageIsReached(progress, "senate"));
  assert.equal(progress.current, "senate");
});

void test("passed Senate does not invent House passage", () => {
  const progress = billProgressFromStatus("Passed Senate");
  assert.ok(stageIsReached(progress, "senate"));
  assert.ok(!stageIsReached(progress, "house"));
});

void test("passed both chambers stops at the executive", () => {
  const progress = billProgressFromStatus("Passed both chambers");
  assert.ok(stageIsReached(progress, "house"));
  assert.ok(stageIsReached(progress, "senate"));
  assert.ok(!stageIsReached(progress, "executive"));
  assert.equal(progress.current, "executive");
});

void test("enacted fills the whole path", () => {
  const progress = billProgressFromStatus("Enacted");
  assert.equal(progress.reached.length, 4);
  assert.equal(progress.current, "executive");
});

void test("a raw action string does not fill chambers", () => {
  const progress = billProgressFromStatus(
    "Motion to reconsider laid on the table Agreed to without objection",
  );
  assert.deepEqual(progress.reached, []);
});
