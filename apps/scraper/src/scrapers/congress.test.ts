import assert from "node:assert/strict";
import test from "node:test";

import {
  capToTsvectorLimit,
  parseBillIdentifier,
  parseBillUrl,
} from "./congress.js";

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

test("capToTsvectorLimit leaves normal bill text untouched", () => {
  const text =
    "SECTION 1. SHORT TITLE. This Act may be cited as the Example Act.";
  assert.equal(capToTsvectorLimit(text, "H.R. 1"), text);
});

test("capToTsvectorLimit keeps oversized text under the tsvector byte ceiling", () => {
  // Multibyte punctuation: a character-based slice would undercount bytes.
  const huge = "section § one — text ".repeat(80_000);
  assert.ok(Buffer.byteLength(huge, "utf8") > 1_048_575);

  const capped = capToTsvectorLimit(huge, "H.R. 1");
  assert.ok(Buffer.byteLength(capped, "utf8") <= 800_000);
  assert.ok(capped.length > 0);
  assert.doesNotMatch(capped, /\s$/u);
});
