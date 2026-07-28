import assert from "node:assert/strict";
import test from "node:test";

import {
  advancesCursor,
  assertWithinTsvectorLimit,
  BillTextTooLargeError,
  cursorHighWaterMark,
  orderTextVersionsNewestFirst,
  parseBillIdentifier,
  parseBillUrl,
  SORT_UPDATE_ASC,
  SORT_UPDATE_DESC,
} from "./congress.js";

test("sort parameters survive URLSearchParams encoding", () => {
  // congress.gov wants `updateDate+desc` on the wire. A literal `+` in the
  // source string is percent-encoded to `%2B`, which the API does not
  // recognise: it silently ignores the sort and returns its default (ascending)
  // order. Writing the value with a space produces the `+` the API wants.
  //
  // This is not hypothetical. `sort=updateDate%2Bdesc` returns the *oldest*
  // bills of the congress, so a "100 most recently updated" run served up
  // January 2025 instead. The ascending walk only looked correct because
  // ascending is the default it was falling back to.
  const encode = (value: string) =>
    new URLSearchParams({ sort: value }).toString();

  assert.equal(encode(SORT_UPDATE_DESC), "sort=updateDate+desc");
  assert.equal(encode(SORT_UPDATE_ASC), "sort=updateDate+asc");

  assert.notEqual(encode("updateDate+desc"), "sort=updateDate+desc");
});

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

test("assertWithinTsvectorLimit leaves normal bill text untouched", () => {
  const text =
    "SECTION 1. SHORT TITLE. This Act may be cited as the Example Act.";
  assert.equal(assertWithinTsvectorLimit(text, "H.R. 1"), text);
});

test("assertWithinTsvectorLimit refuses oversized text instead of truncating", () => {
  // Multibyte punctuation: a character count would undercount the byte size.
  const huge = "section § one — text ".repeat(80_000);
  assert.ok(Buffer.byteLength(huge, "utf8") > 1_048_575);

  // A truncated bill reads as complete and misinforms; an absent one does not.
  assert.throws(
    () => assertWithinTsvectorLimit(huge, "H.R. 1"),
    (error: unknown) =>
      error instanceof BillTextTooLargeError &&
      error.label === "H.R. 1" &&
      error.bytes === Buffer.byteLength(huge, "utf8"),
  );
});

const textVersion = (type: string, date: string | null) => ({
  type,
  date,
  formats: [{ type: "Formatted Text", url: `https://example.test/${type}` }],
});

test("orderTextVersionsNewestFirst picks the operative text, not the introduced draft", () => {
  // The real H.R. 7008 payload order: congress.gov returns newest-first, and a
  // plain reverse() picked "Introduced in House" — missing the photo-ID
  // provisions added by the substitute the House actually passed.
  const versions = [
    textVersion("Engrossed in House", "2026-07-22T04:00:00Z"),
    textVersion("Reported in House", "2026-02-03T05:00:00Z"),
    textVersion("Introduced in House", "2026-01-12T05:00:00Z"),
  ];

  assert.equal(
    orderTextVersionsNewestFirst(versions)[0]!.type,
    "Engrossed in House",
  );
  // Same answer regardless of the order the API hands us.
  assert.equal(
    orderTextVersionsNewestFirst([...versions].reverse())[0]!.type,
    "Engrossed in House",
  );
});

test("orderTextVersionsNewestFirst sorts undated versions last", () => {
  const ordered = orderTextVersionsNewestFirst([
    textVersion("Undated", null),
    textVersion("Introduced in House", "2026-01-12T05:00:00Z"),
    textVersion("Engrossed in House", "2026-07-22T04:00:00Z"),
  ]);
  assert.deepEqual(
    ordered.map((v) => v.type),
    ["Engrossed in House", "Introduced in House", "Undated"],
  );
});

test("cursor advances only across the leading run of successes", () => {
  const d = (n: number) => new Date(`2026-07-0${n}T00:00:00Z`);
  const ok = (n: number) => ({ ok: true, sourceUpdatedAt: d(n) });
  const bad = { ok: false };

  // All clean: advance to the newest.
  assert.deepEqual(cursorHighWaterMark([ok(1), ok(2), ok(3)]), {
    highWaterMark: d(3),
    held: 0,
  });
  // Failure in the middle: hold at the last clean bill before it, even though
  // a later bill succeeded and is newer.
  assert.deepEqual(cursorHighWaterMark([ok(1), bad, ok(3)]), {
    highWaterMark: d(1),
    held: 2,
  });
  // First bill fails: do not advance at all.
  assert.deepEqual(cursorHighWaterMark([bad, ok(2)]), {
    highWaterMark: undefined,
    held: 2,
  });
  assert.deepEqual(cursorHighWaterMark([]), {
    highWaterMark: undefined,
    held: 0,
  });
});

test("only a deferred outcome holds the cursor", () => {
  // A bill we decided against storing must not wedge the walk; a bill we
  // failed to finish must. Getting this backwards is how bills get silently
  // dropped (advance past unfinished work) or how the walk stalls forever
  // (hold on a permanent condition).
  assert.equal(advancesCursor({ status: "written", id: "x" }), true);
  assert.equal(
    advancesCursor({ status: "skipped", reason: "no summary source" }),
    true,
  );
  assert.equal(
    advancesCursor({ status: "deferred", reason: "run budget reached" }),
    false,
  );
});
