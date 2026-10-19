import assert from "node:assert/strict";
import test from "node:test";

import { courtSourceDate, governmentSourceDate } from "./content-source-date";

void test("government source metadata identifies publication, not signing or import", () => {
  const publishedDate = new Date("2026-10-16T00:30:00Z");
  for (const [source, kind, timeZone] of [
    ["whitehouse.gov", "whiteHousePublished", "America/New_York"],
    ["federalregister.gov", "federalRegisterPublished", "UTC"],
    ["other.gov", "published", "UTC"],
  ] as const) {
    assert.deepEqual(governmentSourceDate({ publishedDate, source }), {
      kind,
      date: publishedDate,
      timeZone,
    });
  }
});

void test("court source dates distinguish opinion releases from docket activity", () => {
  const filedDate = new Date("2026-10-15T00:00:00Z");
  for (const [url, kind] of [
    [
      "https://www.supremecourt.gov/opinions/26pdf/example.pdf",
      "opinionReleased",
    ],
    [
      "https://ecourtrecords.org/us/massachusetts/case/example/",
      "latestDocketEntry",
    ],
    ["https://www.courtlistener.com/docket/example/", "courtRecordDated"],
    ["https://www.supremecourt.gov/docket/docket.aspx", "courtRecordDated"],
    ["invalid", "courtRecordDated"],
  ] as const) {
    assert.deepEqual(courtSourceDate({ filedDate, url }), {
      kind,
      date: filedDate,
      timeZone: "UTC",
    });
    assert.equal(courtSourceDate({ filedDate: null, url }), null);
  }
});
