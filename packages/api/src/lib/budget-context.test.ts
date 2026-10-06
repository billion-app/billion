import assert from "node:assert/strict";
import test from "node:test";

import {
  contextMoneyLabel,
  contextMoneyMentions,
  contextMoneySchema,
} from "@acme/validators";

const scope = {
  period: "2027–28",
  jurisdiction: "California",
  timing: "annual" as const,
  accounting: "gross" as const,
};
const value = {
  nominal: "$5–15 billion",
  currency: "USD" as const,
  scope,
  comparison: {
    state: "available" as const,
    numerator: { min: 5_000_000_000, max: 15_000_000_000 },
    denominator: {
      name: "illustrative General Fund budget",
      amount: 250_000_000_000,
      currency: "USD" as const,
      scope,
      evidence: [{ sourceId: "budget", locator: "Illustrative assumption" }],
    },
    basis: "illustrative" as const,
  },
};
void test("budget shares derive from monetary ranges and disclose denominator and scope", () => {
  const parsed = contextMoneySchema.parse(value);
  const label = contextMoneyLabel(parsed);
  assert.match(label, /\$5–15 billion USD · 2–6%/);
  assert.match(
    label,
    /\$250 billion USD; 2027–28; California; annual; gross basis; illustrative/,
  );
  const changed = structuredClone(value);
  changed.comparison.denominator.amount = 500_000_000_000;
  assert.match(contextMoneyLabel(contextMoneySchema.parse(changed)), /1–3%/);
});
void test("mismatched period, jurisdiction, annual versus stock, gross versus net, currency and reversed ranges are rejected", () => {
  for (const change of [
    { period: "2022" },
    { jurisdiction: "County" },
    { timing: "stock" },
    { accounting: "net" },
  ]) {
    assert.equal(
      contextMoneySchema.safeParse({
        ...value,
        comparison: {
          ...value.comparison,
          denominator: {
            ...value.comparison.denominator,
            scope: { ...scope, ...change },
          },
        },
      }).success,
      false,
    );
  }
  for (const amount of [0, -1, Infinity, NaN])
    assert.equal(
      contextMoneySchema.safeParse({
        ...value,
        comparison: {
          ...value.comparison,
          denominator: { ...value.comparison.denominator, amount },
        },
      }).success,
      false,
    );
  assert.equal(
    contextMoneySchema.safeParse({ ...value, currency: "EUR" }).success,
    false,
  );
  assert.equal(
    contextMoneySchema.safeParse({
      ...value,
      comparison: { ...value.comparison, numerator: { min: 15, max: 5 } },
    }).success,
    false,
  );
});
void test("unavailable and inapplicable comparisons retain nominal value without invented percentages", () => {
  for (const state of ["unavailable", "inapplicable"] as const) {
    const parsed = contextMoneySchema.parse({
      ...value,
      comparison: {
        state,
        reason: "No matched annual budget in captured evidence.",
      },
    });
    const label = contextMoneyLabel(parsed);
    assert.match(label, new RegExp(`Budget share ${state}`));
    assert.match(label, /\$5–15 billion/);
    assert.equal(label.includes("%"), false);
  }
  assert.equal(
    contextMoneySchema.safeParse({
      ...value,
      comparison: { state: "unavailable", reason: "" },
    }).success,
    false,
  );
});
void test("money detection covers currency values, ranges and verbal estimates without counting nonmonetary percentages", () => {
  assert.equal(
    contextMoneyMentions(
      "$100bn taxes, $10bn balance and $0.75bn deposit; $0.75bn changes destination",
    ).length,
    3,
  );
  assert.equal(contextMoneyMentions("$5–15 billion a year").length, 1);
  assert.equal(
    contextMoneyMentions(
      "tens of millions to low hundreds of millions of dollars",
    ).length,
    1,
  );
  assert.equal(contextMoneyMentions("a 20% cap in 2027–28").length, 0);
  assert.equal(
    contextMoneyMentions("15 million people and 3 billion trees").length,
    0,
  );
  assert.equal(
    contextMoneyMentions("USD -15bn and $2 trillion and 30 million dollars")
      .length,
    3,
  );
  assert.equal(contextMoneyMentions("tens of billions of dollars").length, 1);
});

void test("nominal amount cannot disagree with the computed-share numerator", () => {
  assert.equal(
    contextMoneySchema.safeParse({
      ...value,
      nominal: "$5 billion",
      comparison: {
        ...value.comparison,
        numerator: { min: 5_000_000, max: 5_000_000 },
      },
    }).success,
    false,
  );
  assert.equal(
    contextMoneySchema.safeParse({
      ...value,
      nominal: "$5",
      comparison: {
        ...value.comparison,
        numerator: { min: 5_000_000_000, max: 5_000_000_000 },
      },
    }).success,
    false,
  );
  for (const nominal of ["$", "5 billion", "$5 billion extra words"])
    assert.equal(
      contextMoneySchema.safeParse({
        ...value,
        nominal,
        comparison: { state: "unavailable", reason: "No matched budget" },
      }).success,
      false,
    );
});

void test("qualitative ranges cannot acquire invented numeric shares or hidden amount labels", () => {
  assert.equal(
    contextMoneySchema.safeParse({
      ...value,
      nominal: "tens of billions of dollars",
    }).success,
    false,
  );
  assert.equal(
    contextMoneySchema.safeParse({
      ...value,
      comparison: { state: "unavailable", reason: "Compare with $250 billion" },
    }).success,
    false,
  );
  assert.equal(
    contextMoneyMentions("5 million USD and five billion dollars").length,
    2,
  );
});

void test("decimal billion values agree with exact dollar numerators at cent precision", () => {
  for (const [nominal, amount] of [
    ["$4.1 billion", 4_100_000_000],
    ["$8.2 billion", 8_200_000_000],
  ] as const) {
    assert.equal(
      contextMoneySchema.safeParse({
        ...value,
        nominal,
        comparison: {
          ...value.comparison,
          numerator: { min: amount, max: amount },
        },
      }).success,
      true,
    );
  }
});
