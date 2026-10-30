import assert from "node:assert/strict";
import { test } from "node:test";

import type { BillBriefData } from "./BillBrief";
import {
  getBillMetricComparison,
  getBillPercent,
  getBillVisualKind,
  getPrimaryMetricFacts,
  isEssentialMetricNote,
} from "./bill-visual";

test("one leading metric keeps a supported percentage visible without comparing unrelated values", () => {
  const facts = [
    { label: "Budget", value: "$100" },
    { label: "Days", value: "30 days" },
    { label: "Share", value: "51% of capacity" },
  ];
  assert.deepEqual(getPrimaryMetricFacts(facts), [facts[2]]);
  assert.deepEqual(getPrimaryMetricFacts(facts.slice(0, 2)), [facts[0]]);
  assert.deepEqual(getPrimaryMetricFacts([]), []);
});

test("compact metrics retain numbers and explicit limitations beside their value", () => {
  for (const note of [
    "Only when bond is available",
    "Capacity means how much power the projects can produce at once.",
    "This measures the maximum amount of electricity produced at one time.",
    "Enrollment closes at 4 GW or after 7 years, whichever comes first.",
    "Not available to all applicants",
    "Must serve low-income customers.",
    "Applies when jury is waived",
    "至少四小时",
    "Solo para solicitantes elegibles",
  ])
    assert.equal(isEssentialMetricNote(note), true, note);
  assert.equal(
    isEssentialMetricNote("Battery must match solar capacity."),
    true,
  );
  assert.equal(
    isEssentialMetricNote("Per community renewable energy generator."),
    false,
  );
});

test("metric context preserves the supplied baseline and never invents a numeric one", () => {
  const fact = {
    label: "Low-income capacity",
    value: "51% of capacity",
    quote: { text: "Require at least 51 percent of capacity." },
  };
  const change: BillBriefData["changes"][number] = {
    kind: "requires",
    title: "Set-aside",
    before: "Current law **does not require a set-aside**.",
    after: "Require at least 51% of capacity.",
    quote: fact.quote,
  };
  assert.equal(
    getBillMetricComparison(fact, [change]),
    "Current law does not require a set-aside.",
  );
  assert.equal(
    getBillMetricComparison(fact, [
      { ...change, before: "20% of capacity is required today." },
    ]),
    "20% of capacity is required today.",
  );
  assert.equal(getBillMetricComparison(fact, [change, change]), null);
  assert.equal(
    getBillMetricComparison(fact, [
      { ...change, quote: { text: "Different provision." } },
    ]),
    null,
  );
  assert.equal(
    getBillMetricComparison(fact, [
      { ...change, quote: { ...fact.quote, documentId: "other" } },
    ]),
    null,
  );
  assert.equal(
    getBillMetricComparison({ ...fact, quote: undefined }, [change]),
    null,
  );
  assert.equal(
    getBillMetricComparison({ ...fact, value: "Before evidence starts" }, [
      change,
    ]),
    null,
  );
  assert.equal(
    getBillMetricComparison(fact, [{ ...change, before: "" }]),
    null,
  );
  assert.equal(
    getBillMetricComparison(fact, [
      { ...change, before: "Full qualification. ".repeat(15) },
    ]),
    null,
  );
});

test("percentage positions require one explicit, bounded percentage", () => {
  for (const [supplied, expected] of [
    ["51% of capacity", 51],
    ["At least 15%", 15],
    ["0%", 0],
    ["100% reimbursement", 100],
    ["12.5%", 12.5],
    ["110%", null],
    ["-10%", null],
    ["10–15%", null],
    ["87% by 2040", null],
    ["5% + 10%", null],
    ["51", null],
    ["Three conditions", null],
    ["5 MW generation + 5 MW storage", null],
  ] as const) {
    assert.equal(getBillPercent(supplied), expected, supplied);
  }
});

test("every bill gets a suitable visual, including absent and nonnumeric facts", () => {
  assert.equal(getBillVisualKind([]), "changes");
  assert.equal(
    getBillVisualKind([
      { label: "Notice", value: "Before evidence starts" },
      { label: "Required findings", value: "Three conditions" },
    ]),
    "changes",
  );
  assert.equal(
    getBillVisualKind([
      { label: "Bond", value: "$1,500 minimum" },
      { label: "Review", value: "Within 30 days" },
    ]),
    "changes",
  );
  assert.equal(
    getBillVisualKind([
      { label: "Low-income set-aside", value: "51% of capacity" },
    ]),
    "percentage",
  );
  assert.equal(
    getBillVisualKind([
      { label: "Deadline", value: "September 30, 2027" },
      { label: "Report", value: "December 31, 2027" },
    ]),
    "dates",
  );
  assert.equal(
    getBillVisualKind([
      {
        label: "Initial trigger",
        value: "80°F heat index",
        note: "Proposed rule",
      },
      {
        label: "High trigger",
        value: "90°F heat index",
        note: "Proposed rule",
      },
    ]),
    "temperature",
  );
});
