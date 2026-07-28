import assert from "node:assert/strict";
import test from "node:test";

import {
  assertWithinTsvectorLimit,
  BillTextTooLargeError,
  orderTextVersionsNewestFirst,
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
  // Mirrors the reduction in scrape(): the feed is oldest-first, so the first
  // failure is the high-water mark. Advancing past it would strand that bill
  // exactly the way the old wall-clock cursor did.
  const advance = (outcomes: { ok: boolean; at?: string }[]) => {
    const firstFailure = outcomes.findIndex((o) => !o.ok);
    const settled =
      firstFailure === -1 ? outcomes : outcomes.slice(0, firstFailure);
    return settled.reduce<string | undefined>(
      (newest, o) => (o.at && (!newest || o.at > newest) ? o.at : newest),
      undefined,
    );
  };

  const d = (n: number) => `2026-07-0${n}T00:00:00Z`;

  // All clean: advance to the newest.
  assert.equal(
    advance([
      { ok: true, at: d(1) },
      { ok: true, at: d(2) },
      { ok: true, at: d(3) },
    ]),
    d(3),
  );
  // Failure in the middle: hold at the last clean bill before it, even though
  // a later bill succeeded and is newer.
  assert.equal(
    advance([{ ok: true, at: d(1) }, { ok: false }, { ok: true, at: d(3) }]),
    d(1),
  );
  // First bill fails: do not advance at all.
  assert.equal(advance([{ ok: false }, { ok: true, at: d(2) }]), undefined);
  assert.equal(advance([]), undefined);
});
