import assert from "node:assert/strict";
import test from "node:test";

import {
  featuredBillAccessibilityLabel,
  withoutFeaturedBills,
} from "./featured-bills";

void test("removes featured bills from the regular feed", () => {
  assert.deepEqual(
    withoutFeaturedBills(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [{ id: "b" }],
    ),
    [{ id: "a" }, { id: "c" }],
  );
});

void test("builds one complete screen-reader label", () => {
  const label = featuredBillAccessibilityLabel(
    {
      id: "a",
      type: "bill",
      title: "Voter ID Act",
      description: "Requires photo identification for federal elections.",
      billNumber: "H.R. 9368",
      billStatus: "On the House calendar",
      featureTakeaway: "A nationwide voting rule",
      featuredPosition: 1,
    },
    0,
    3,
  );

  assert.equal(
    label,
    "Featured bill 1 of 3. H.R. 9368. Voter ID Act. A nationwide voting rule. On the House calendar",
  );
});
