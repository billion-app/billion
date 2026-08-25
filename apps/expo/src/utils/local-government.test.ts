import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyDecision,
  detectJurisdictionKey,
  documentCategoryLabel,
  formatMeetingDate,
  groupVotesByOccurrence,
  lifecycleLabel,
  scopeInfo,
  sortTimeline,
  timelineSummary,
  topicLabel,
  truncate,
  voteAvailability,
  voteValueLabel,
} from "./local-government";

const FUTURE = new Date("2026-12-01T17:00:00-08:00");
const PAST = new Date("2026-06-01T17:00:00-08:00");
const NOW = new Date("2026-08-24T12:00:00-07:00");

describe("classifyDecision", () => {
  it("treats a future meeting as upcoming", () => {
    const result = classifyDecision(
      { meetingStartsAt: FUTURE, status: "Pending" },
      NOW,
    );
    assert.equal(result, "upcoming");
    assert.equal(lifecycleLabel(result), "Scheduled for a public meeting");
  });

  it("treats past meetings without outcomes as awaiting outcome, not decided", () => {
    const result = classifyDecision(
      { meetingStartsAt: PAST, status: "Pending", outcome: null },
      NOW,
    );
    assert.equal(result, "awaiting_outcome");
    assert.match(lifecycleLabel(result), /outcome not yet published/i);
  });

  it("maps approval language to approved", () => {
    assert.equal(classifyDecision({ outcome: "Adopted" }, NOW), "approved");
    assert.equal(
      classifyDecision({ status: "Adopted", outcome: "" }, NOW),
      "approved",
    );
    assert.equal(classifyDecision({ passed: "Pass" }, NOW), "approved");
  });

  it("maps rejection language to not approved", () => {
    assert.equal(classifyDecision({ outcome: "Failed" }, NOW), "rejected");
    assert.equal(
      classifyDecision({ outcome: "Deny the appeal" }, NOW),
      "rejected",
    );
  });

  it("maps deferred and withdrawn language", () => {
    assert.equal(classifyDecision({ outcome: "Continued" }, NOW), "deferred");
    assert.equal(classifyDecision({ status: "Withdrawn" }, NOW), "withdrawn");
  });

  it("maps cancelled meetings without recorded action", () => {
    const result = classifyDecision(
      { meetingCancelled: true, meetingStartsAt: PAST },
      NOW,
    );
    assert.equal(result, "cancelled");
  });

  it("keeps informational items distinct", () => {
    assert.equal(
      classifyDecision(
        { type: "Informational Report", meetingStartsAt: FUTURE },
        NOW,
      ),
      "informational",
    );
  });

  it("reports unknown action language as decided_other instead of guessing", () => {
    assert.equal(
      classifyDecision({ outcome: "Referred to committee" }, NOW),
      "decided_other",
    );
  });
});

describe("scope display", () => {
  it("labels citywide scope", () => {
    const info = scopeInfo("citywide", null, null);
    assert.equal(info.label, "Citywide");
    assert.match(info.sentence ?? "", /whole city/);
  });

  it("renders district numbers plainly", () => {
    const info = scopeInfo("district", [3], "Council District 3");
    assert.equal(info.label, "District 3");
    assert.equal(info.sentence, "Affects District 3.");
  });

  it("supports multiple districts", () => {
    const info = scopeInfo("district", [2, 7], null);
    assert.equal(info.label, "District 2 · District 7");
  });

  it("uses place text for place scope", () => {
    const info = scopeInfo("place", null, "100 N Market St");
    assert.equal(info.kind, "place");
    assert.ok((info.label ?? "").length > 0);
  });

  it("returns no label when geography is unknown", () => {
    const info = scopeInfo("unknown", null, null);
    assert.equal(info.label, null);
    assert.equal(info.sentence, null);
  });
});

describe("timeline ordering", () => {
  it("sorts occurrences chronologically with undated rows last", () => {
    const sorted = sortTimeline([
      { startsAt: PAST },
      { startsAt: null },
      { startsAt: FUTURE },
    ]);
    assert.deepEqual(
      sorted.map((o) => o.startsAt),
      [PAST, FUTURE, null],
    );
  });

  it("does not mutate its input", () => {
    const input = [{ startsAt: FUTURE }, { startsAt: PAST }];
    sortTimeline(input);
    assert.equal(input[0]?.startsAt, FUTURE);
  });

  it("summarizes occurrences for cards", () => {
    const summary = timelineSummary([
      {
        id: "1",
        startsAt: FUTURE,
        body: "City Council",
        agendaNumber: "3.1",
        action: null,
        tally: null,
        cancelled: false,
      } as never,
    ]);
    assert.equal(summary[0]?.body ?? "", "City Council");
    assert.equal(summary[0]?.agendaNumber ?? null, "3.1");
  });
});

describe("vote availability language", () => {
  it("shows votes when published", () => {
    const availability = voteAvailability(
      { action: "Approved", tally: "5-2" },
      true,
    );
    assert.equal(availability.visible, true);
  });

  it("never implies missing votes mean nobody voted (with tally)", () => {
    const availability = voteAvailability(
      { action: "Approved", tally: "5-2" },
      false,
    );
    assert.equal(availability.visible, false);
    assert.match(
      availability.headline,
      /Individual votes have not been published/,
    );
    assert.match(availability.detail ?? "", /5-2/);
  });

  it("never implies missing votes mean nobody voted (without tally)", () => {
    const availability = voteAvailability(
      { action: "Approved", tally: null },
      false,
    );
    assert.equal(availability.visible, false);
    assert.match(
      availability.headline,
      /Individual votes have not been published/,
    );
  });

  it("distinguishes no-vote-yet for unheard items", () => {
    const availability = voteAvailability({ action: null, tally: null }, false);
    assert.match(availability.headline, /No vote recorded yet/);
  });

  it("normalizes vote values", () => {
    assert.equal(voteValueLabel("yes"), "Yes");
    assert.equal(voteValueLabel("NAY"), "No");
    assert.equal(voteValueLabel("Abstaining"), "Abstained");
    assert.equal(voteValueLabel("Recused"), "Recused");
  });

  it("groups votes under their occurrence", () => {
    const grouped = groupVotesByOccurrence([
      { meetingItemId: "a", personName: "A", value: "Yes", sort: 1 },
      { meetingItemId: "b", personName: "B", value: "No", sort: 1 },
      { meetingItemId: "a", personName: "C", value: "Yes", sort: 2 },
    ]);
    assert.equal(grouped.get("a")?.length, 2);
    assert.equal(grouped.get("b")?.length, 1);
  });
});

describe("jurisdiction detection", () => {
  it("defaults to san jose when nothing is saved", () => {
    assert.equal(detectJurisdictionKey(null), "sanjose");
    assert.equal(detectJurisdictionKey(undefined), "sanjose");
  });

  it("detects san jose addresses", () => {
    assert.equal(
      detectJurisdictionKey("200 E Santa Clara St, San Jose, CA"),
      "sanjose",
    );
  });

  it("separates county and neighboring cities", () => {
    assert.equal(detectJurisdictionKey("Santa Clara County"), "santaclara");
    assert.equal(detectJurisdictionKey("Sunnyvale, CA"), "sunnyvale");
  });
});

describe("topics and documents", () => {
  it("de-jargonizes topics", () => {
    assert.equal(topicLabel("housing-land-use"), "Housing & land use");
    assert.equal(topicLabel("budget-finance"), "Budget, fees & contracts");
  });

  it("passes unknown topics through cleanly", () => {
    assert.equal(topicLabel(null), null);
    assert.equal(topicLabel("something_new"), "Something New");
  });

  it("labels document categories", () => {
    assert.equal(documentCategoryLabel("staff_report"), "Staff report");
    assert.equal(documentCategoryLabel("minutes_order"), "Minutes order");
    assert.equal(documentCategoryLabel("mystery"), "Mystery");
  });
});

describe("partial-data tolerance", () => {
  it("formats absent dates honestly", () => {
    assert.equal(formatMeetingDate(null), "Date not published");
    assert.equal(formatMeetingDate("not-a-date"), "Date not published");
  });

  it("truncates long titles without breaking characters", () => {
    const long = "Ordinance of the City of San José amending ".repeat(4);
    const cut = truncate(long, 60);
    assert.ok(cut.length <= 60);
    assert.ok(cut.endsWith("…"));
  });
});
