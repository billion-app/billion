import assert from "node:assert/strict";
import test from "node:test";

import {
  BILL_DESCRIPTION_MAX_CHARS,
  clampBillDescription,
} from "./bill-description.js";

test("clampBillDescription preserves short descriptions", () => {
  assert.equal(
    clampBillDescription(
      "  Funds wildfire research for West Coast vineyards.  ",
    ),
    "Funds wildfire research for West Coast vineyards.",
  );
});

test("clampBillDescription normalizes whitespace and truncates on a word", () => {
  const description = clampBillDescription(
    "This bill directs the Agricultural Research Service to conduct detailed research on smoke exposure and wine grapes across California, Oregon, and Washington.",
  );

  assert.ok(description.length <= BILL_DESCRIPTION_MAX_CHARS);
  assert.match(description, /…$/u);
  assert.doesNotMatch(description, /\s{2,}/u);
  assert.doesNotMatch(description, /\s…$/u);
});
