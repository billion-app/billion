import assert from "node:assert/strict";
import test from "node:test";

import {
  cityKey,
  localFilters,
  localListHref,
  meetingDate,
} from "./local-presentation";

void test("local routes only accept supported city keys", () => {
  assert.equal(cityKey.safeParse("santaclara").success, true);
  assert.equal(cityKey.safeParse("santaclaracounty").success, false);
  assert.equal(cityKey.safeParse("sunnyvale").success, false);
});

void test("invalid URL filters fall back to the first upcoming page", () => {
  assert.deepEqual(
    localFilters.parse({ timeline: "past", offset: "-20", topic: [] }),
    { timeline: "upcoming", offset: 0, topic: "" },
  );
  assert.equal(localFilters.parse({ offset: "10001" }).offset, 0);
});

void test("pagination retains timeline and topic", () => {
  assert.equal(
    localListHref("sanjose", {
      timeline: "recent",
      topic: "housing-land-use",
      offset: 20,
    }),
    "/local/sanjose?timeline=recent&topic=housing-land-use&offset=20",
  );
});

void test("meeting dates stay in the city's timezone", () => {
  assert.equal(
    meetingDate("2026-10-27T01:00:00.000Z"),
    "October 26, 2026 at 6:00 PM Pacific",
  );
  assert.equal(meetingDate(null), "Date not published");
});
