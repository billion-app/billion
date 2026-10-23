import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatPlacemark } from "./address";
import {
  classifyDecision,
  detectJurisdictionKey,
  documentCategoryLabel,
  formatMeetingDate,
  groupVotesByOccurrence,
  isLocalJurisdictionKey,
  lifecycleLabel,
  LOCAL_JURISDICTION_KEYS,
  localJurisdictionsInState,
  localJurisdictionText,
  scopeInfo,
  selectHomeDecisions,
  sortTimeline,
  timelineSummary,
  topicLabel,
  truncate,
  voteAvailability,
  voteValueLabel,
  voteValueTone,
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

describe("supported local jurisdictions", () => {
  it("offers reviewed cities only under California", () => {
    assert.deepEqual(LOCAL_JURISDICTION_KEYS, ["sanjose", "santaclara"]);
    assert.deepEqual(localJurisdictionsInState("ca"), [
      "sanjose",
      "santaclara",
    ]);
    assert.deepEqual(localJurisdictionsInState("tx"), []);
  });

  it("rejects unsupported Legistar clients as route input", () => {
    assert.equal(isLocalJurisdictionKey("sanjose"), true);
    for (const value of ["sunnyvale", "", undefined, null]) {
      assert.equal(isLocalJurisdictionKey(value), false, String(value));
    }
  });

  it("names the city government, never the county", () => {
    assert.deepEqual(localJurisdictionText("sanjose"), {
      name: "San José",
      body: "City of San José",
      description: "City Council and commission decisions",
    });
    assert.equal(localJurisdictionText("sanjose", "zh").body, "圣何塞市");
    assert.doesNotMatch(
      Object.values(localJurisdictionText("sanjose")).join(" "),
      /county/i,
    );
  });
});

const CITY_HALL = { streetNumber: "200", street: "E Santa Clara St" };

describe("jurisdiction detection from device locations", () => {
  const sanJose: [string, Parameters<typeof formatPlacemark>[0]][] = [
    [
      "Apple CLGeocoder observed on 2026-10-22",
      { ...CITY_HALL, city: "San Jose", region: "CA", postalCode: "95113" },
    ],
    ["iOS without a postal code", { ...CITY_HALL, city: "San Jose" }],
    [
      "synthetic Spanish placemark",
      { ...CITY_HALL, city: "San José", region: "CA", postalCode: "95113" },
    ],
    [
      "synthetic Simplified Chinese placemark",
      {
        ...CITY_HALL,
        city: "圣何塞",
        region: "加利福尼亚州",
        postalCode: "95113",
      },
    ],
    [
      "Android-style composed line",
      { formattedAddress: "200 E Santa Clara St, San Jose, CA 95113, USA" },
    ],
    [
      "composed line with a unit and ZIP+4",
      {
        formattedAddress:
          "200 E Santa Clara St #1, San Jose, CA 95113-1905, United States",
      },
    ],
    [
      "synthetic Spanish composed line",
      {
        formattedAddress: "200 E Santa Clara St, San José, CA 95113, EE. UU.",
      },
    ],
    [
      "Android discrete fields with the full state name",
      {
        ...CITY_HALL,
        city: "San Jose",
        region: "California",
        postalCode: "95113",
      },
    ],
  ];
  for (const [platform, placemark] of sanJose) {
    it(`detects San José: ${platform}`, () => {
      const address = formatPlacemark(placemark);
      assert.ok(address, platform);
      assert.equal(detectJurisdictionKey(address), "sanjose", address);
    });
  }

  it("treats a decomposed accent like the composed one", () => {
    const decomposed = "San José";
    const address = formatPlacemark({ ...CITY_HALL, city: decomposed });
    assert.equal(detectJurisdictionKey(address), "sanjose");
  });

  const notSanJose: [string, Parameters<typeof formatPlacemark>[0]][] = [
    [
      "a county-only iOS placemark (no locality)",
      { ...CITY_HALL, subregion: "Santa Clara County", region: "CA" },
    ],
    [
      "Sunnyvale",
      { formattedAddress: "456 W Olive Ave, Sunnyvale, CA 94086, USA" },
    ],
    [
      "San José, Costa Rica",
      { formattedAddress: "Avenida Central, San José, Costa Rica" },
    ],
  ];
  for (const [label, placemark] of notSanJose) {
    it(`leaves ${label} unsupported`, () => {
      assert.equal(detectJurisdictionKey(formatPlacemark(placemark)), null);
    });
  }
});

describe("jurisdiction detection from typed addresses", () => {
  it("does not assume san jose when no address is saved", () => {
    assert.equal(detectJurisdictionKey(null), null);
    assert.equal(detectJurisdictionKey(undefined), null);
    assert.equal(detectJurisdictionKey("   "), null);
  });

  it("accepts common typed forms", () => {
    for (const address of [
      "San José, CA",
      "san jose",
      "123 Main St, San Jose CA 95112",
      "123 Main St, San Jose, CA, 95112",
      "123 Main St, SAN JOSE, CALIFORNIA",
      "City of San José, CA, USA",
    ]) {
      assert.equal(detectJurisdictionKey(address), "sanjose", address);
    }
  });

  it("rejects san jose street names, other states, and county wording", () => {
    for (const address of [
      "Oakland, CA",
      "123 San Jose Blvd, Jacksonville, FL 32257",
      "San Jose, NM",
      "Santa Clara County",
      "70 W Hedding St, Santa Clara County, CA 95110",
      "Unincorporated Santa Clara County, CA",
      "CA 95113",
    ]) {
      assert.equal(detectJurisdictionKey(address), null, address);
    }
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

it("localized labels preserve vote meaning and published source values", () => {
  assert.equal(voteValueLabel("Yea", "zh"), "赞成");
  assert.equal(voteValueLabel("Nay", "es"), "No");
  assert.equal(voteValueTone("Yea"), "for");
  assert.equal(voteValueTone("Nay"), "against");
  assert.equal(
    voteValueLabel("unclassified source value", "zh"),
    "unclassified source value",
  );
  assert.equal(
    scopeInfo("district", [1, 2], null, "zh").sentence,
    "影响第 1 选区、第 2 选区。",
  );
});

describe("Santa Clara city address matching", () => {
  it("accepts the city while rejecting county and street names", () => {
    for (const address of [
      "1500 Warburton Ave, Santa Clara, CA 95050",
      "City of Santa Clara, California, USA",
      "圣克拉拉, 加州",
    ])
      assert.equal(detectJurisdictionKey(address), "santaclara");
    for (const address of [
      "Santa Clara County, CA",
      "Unincorporated Santa Clara, CA",
      "123 Santa Clara St, Sunnyvale, CA",
      "Santa Clara, UT",
      "Santa Clara",
    ])
      assert.equal(detectJurisdictionKey(address), null);
    assert.equal(
      detectJurisdictionKey("200 E Santa Clara St, San Jose, CA"),
      "sanjose",
    );
    assert.equal(
      localJurisdictionText("santaclara").body,
      "City of Santa Clara",
    );
  });
});

describe("Home decision selection", () => {
  const row = (id: string, day: number, bodyRelevanceTier = 1) => ({
    id,
    meetingStartsAt: new Date(Date.UTC(2026, 11, day)),
    bodyRelevanceTier,
  });
  it("keeps followed records first, then relevant bodies, preserving time order", () => {
    const rows = [
      row("late", 5),
      row("minor", 1, 3),
      row("followed", 4, 3),
      row("early", 2),
      row("late", 7),
    ];
    assert.deepEqual(
      selectHomeDecisions(rows, new Set(["followed"])).map(({ id }) => id),
      ["followed", "early", "late"],
    );
    assert.equal(rows.length, 5);
    assert.equal(
      selectHomeDecisions(rows, new Set(), 5)
        .find(({ id }) => id === "late")
        ?.meetingStartsAt.getUTCDate(),
      5,
    );
  });
});
