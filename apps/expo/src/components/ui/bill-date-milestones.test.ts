import assert from "node:assert/strict";
import test from "node:test";

import {
  getBillDateMilestones,
  getBillDateValue,
} from "./bill-date-milestones";

void test("complete dates sort across supported source formats without shifting time zones", () => {
  const expected = Date.UTC(2028, 11, 31);
  for (const date of [
    "2028-12-31",
    "Dec. 31, 2028",
    "31 December 2028",
    "31 de diciembre de 2028",
    "2028年12月31日",
  ]) {
    assert.equal(getBillDateValue(date), expected);
  }
});
void test("relative, recurring, ambiguous and invalid dates never become milestones", () => {
  for (const value of [
    "90 days after enactment",
    "2029",
    "Every 6 months",
    "July 1, 2027, then every 5 years",
    "01/02/2029",
    "2027-02-29",
    "2028-13-01",
    "July 32, 2028",
    "Before July 1, 2028",
  ]) {
    assert.equal(getBillDateValue(value), null, value);
  }
  assert.notEqual(getBillDateValue("2028-02-29"), null);
});
void test("timeline preserves labels, notes, quotes and original indices; other facts stay separate", () => {
  const late = {
    label: "Reporting deadline",
    value: "July 1, 2029",
    note: "Only covered agencies",
    quote: { text: "reports due July 1, 2029" },
  };
  const early = { label: "Start date", value: "January 1, 2028" };
  const facts = [late, { label: "Funding", value: "$1 million" }, early];
  const dates = getBillDateMilestones(facts);
  assert.deepEqual(
    dates.map((point) => point.fact),
    [early, late],
  );
  assert.deepEqual(
    dates.map((point) => point.index),
    [2, 0],
  );
  assert.equal(dates[1]?.fact, late);
  assert.deepEqual(getBillDateMilestones([early]), []);
  assert.deepEqual(
    getBillDateMilestones([early, { ...early, label: "Same day" }]),
    [],
  );
});
