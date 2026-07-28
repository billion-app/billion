import assert from "node:assert/strict";
import test from "node:test";

import { parseBillIdentifier, parseBillUrl } from "./congress.js";

test("parseBillIdentifier accepts the forms people paste", () => {
  const expected = { billType: "hr", billNumber: "7008" };
  assert.deepEqual(parseBillIdentifier("H.R. 7008"), expected);
  assert.deepEqual(parseBillIdentifier("hr7008"), expected);
  assert.deepEqual(parseBillIdentifier("HR 7008"), expected);
  assert.deepEqual(parseBillIdentifier("  h.r.7008  "), expected);
});

test("parseBillIdentifier handles multi-part resolution types", () => {
  assert.deepEqual(parseBillIdentifier("H.Con.Res. 113"), {
    billType: "hconres",
    billNumber: "113",
  });
  assert.deepEqual(parseBillIdentifier("S.J.Res. 5"), {
    billType: "sjres",
    billNumber: "5",
  });
  assert.deepEqual(parseBillIdentifier("S. 1"), {
    billType: "s",
    billNumber: "1",
  });
});

test("parseBillIdentifier rejects unknown types and malformed input", () => {
  assert.equal(parseBillIdentifier("H.X.Res. 12"), undefined);
  assert.equal(parseBillIdentifier("7008"), undefined);
  assert.equal(parseBillIdentifier("H.R."), undefined);
  assert.equal(parseBillIdentifier("H.R. 70 08"), undefined);
  assert.equal(parseBillIdentifier(""), undefined);
});

test("parseBillIdentifier round-trips through parseBillUrl", () => {
  const parsed = parseBillIdentifier("H.R. 7008")!;
  assert.deepEqual(
    parseBillUrl(
      `https://www.congress.gov/bill/119th-congress/house-bill/${parsed.billNumber}`,
    ),
    parsed,
  );
});
