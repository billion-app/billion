import assert from "node:assert/strict";
import test from "node:test";

import {
  getBillFactDisplay,
  getBillFactFigure,
  getBillFactSymbol,
} from "./bill-fact-figure";

const fact = (
  value: string,
  note = "Under the proposal",
  label = "Heat trigger",
) => ({ value, note, label });
void test("heat-index thresholds use a common unit and preserve supplied notes", () => {
  const first = fact("80°F heat index");
  const second = fact("90°F heat index");
  const figure = getBillFactFigure([second, first]);
  assert.equal(figure?.kind, "temperature");
  assert.deepEqual(
    figure.points.map((point) => point.amount),
    [80, 90],
  );
  assert.equal(figure.points[0].note, first.note);
  assert.equal(figure.min, 75);
  assert.equal(figure.max, 95);
});
void test("different units, duplicate thresholds and dates never imply a numeric comparison", () => {
  assert.notEqual(
    getBillFactFigure([fact("80°F heat index"), fact("90°C heat index")])?.kind,
    "temperature",
  );
  assert.notEqual(
    getBillFactFigure([fact("80°F heat index"), fact("80°F heat index")])?.kind,
    "temperature",
  );
  const dates = [
    fact("July 1, 2029"),
    fact("July 1, 2027, then every 5 years"),
  ];
  assert.deepEqual(getBillFactFigure(dates), {
    kind: "metrics",
    points: dates,
  });
  assert.notEqual(
    getBillFactFigure([
      fact("80°F heat index", "Current requirement"),
      fact("90°F heat index", "Current requirement"),
    ])?.kind,
    "temperature",
  );
});
void test("more thresholds are not silently reduced to a misleading pair", () => {
  assert.notEqual(
    getBillFactFigure([
      fact("80°F heat index"),
      fact("90°F heat index"),
      fact("100°F heat index"),
    ])?.kind,
    "temperature",
  );
});
void test("unrelated numeric facts keep their full qualifiers without a shared scale", () => {
  const first = fact(
    "10% of settlement or judgment",
    "Only insurer attorneys",
    "Fee cap",
  );
  const points = [
    fact("10% of settlement or judgment", "Only insurer attorneys", "Fee cap"),
    fact("30 days after an emergency", "Targeted solicitation", "Blackout"),
  ];
  assert.deepEqual(getBillFactFigure(points), { kind: "metrics", points });
  assert.deepEqual(getBillFactFigure([first]), {
    kind: "metrics",
    points: [first],
  });
});

void test("all facts survive, including a single fact, dates, and scope", () => {
  const points = [
    fact("$1,500", "Minimum bond"),
    fact("90 days"),
    fact("Federal agencies"),
  ];
  assert.deepEqual(getBillFactFigure(points), { kind: "metrics", points });
  assert.equal(getBillFactFigure([]), null);
});

void test("a shared temperature graphic retains other facts as supporting context", () => {
  const date = fact(
    "Aug 30, 2024",
    "Proposed rule publication",
    "Rule targeted",
  );
  const scope = fact(
    "Indoor and outdoor workplaces",
    "Coverage in the proposal",
    "Scope",
  );
  const figure = getBillFactFigure([
    date,
    fact("90°F heat index"),
    scope,
    fact("80°F heat index"),
  ]);
  assert.equal(figure?.kind, "temperature");
  assert.deepEqual(figure.supporting, [date, scope]);
  assert.deepEqual(
    figure.points.map((point) => point.amount),
    [80, 90],
  );
});

void test("numeric prominence preserves currency, ranges, percentages, units and qualifiers", () => {
  for (const [input, value, qualifier] of [
    ["$1,500 minimum bond", "$1,500", "minimum bond"],
    ["10% of settlement or judgment", "10%", "of settlement or judgment"],
    ["30 days after an emergency", "30", "days after an emergency"],
    ["10–15% of earnings", "10–15%", "of earnings"],
    ["-20 days", "-20", "days"],
    ["**€20,000** per applicant", "€20,000", "per applicant"],
    ["¥20,000 per applicant", "¥20,000", "per applicant"],
  ]) {
    assert.deepEqual(getBillFactDisplay(input ?? ""), {
      value,
      qualifier,
      numeric: true,
    });
  }
});

void test("dates and nonnumeric scope keep their full value rather than a misleading leading number", () => {
  for (const value of [
    "July 1, 2029",
    "31 December 2028",
    "31 de diciembre de 2028",
    "2028-12-31",
    "12/31/2028",
    "2028年12月31日",
    "Federal agencies",
  ]) {
    assert.deepEqual(getBillFactDisplay(value), {
      value,
      qualifier: "",
      numeric: false,
    });
  }
});

void test("time-limit prefixes remain attached to the highlighted quantity", () => {
  for (const [input, prefix, value, qualifier] of [
    ["Every 6 months", "Every", "6", "months"],
    ["Within 30 days", "Within", "30", "days"],
    ["At least $1,500", "At least", "$1,500", ""],
    ["Cada 6 meses", "Cada", "6", "meses"],
  ]) {
    assert.deepEqual(getBillFactDisplay(input ?? ""), {
      prefix,
      value,
      qualifier,
      numeric: true,
    });
  }
});
void test("metric icons reflect supplied units and labels without categorizing unrelated facts", () => {
  assert.equal(
    getBillFactSymbol("90 days beyond removal period", "Extra detention"),
    "clock",
  );
  assert.equal(
    getBillFactSymbol("2029", "Earliest year coverage can resume"),
    "calendar",
  );
  assert.equal(getBillFactSymbol("$1,500", "Minimum bond allowed"), null);
  assert.equal(getBillFactSymbol("10%", "Fee cap"), null);
  assert.equal(getBillFactSymbol("4 gigawatts", "Total program cap"), "zap");
  assert.equal(
    getBillFactSymbol("5 MW generation + 5 MW storage", "Per-project size cap"),
    "layers",
  );
  assert.equal(
    getBillFactSymbol("4 hours at same capacity", "Storage requirement"),
    "clock",
  );
  assert.equal(getBillFactSymbol("Federal agencies", "Program limit"), null);
  assert.equal(
    getBillFactSymbol("tens of millions of tons", "Wood waste each year"),
    null,
  );
});
