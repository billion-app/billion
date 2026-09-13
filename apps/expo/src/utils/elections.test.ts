import assert from "node:assert/strict";
import test from "node:test";

import type { Election, PollingLocation } from "@acme/api";

import {
  contestListTitle,
  earliestEarlyVoteStart,
  isCaliforniaRelevantElection,
  isCaliforniaState,
  pickUpcomingCaliforniaElection,
  pollingPlaceSubtitle,
} from "./elections";

function election(
  partial: Partial<Election> & Pick<Election, "id" | "name" | "electionDay">,
): Election {
  return {
    ocdDivisionId: "ocd-division/country:us/state:ca",
    ...partial,
  };
}

void test("isCaliforniaState accepts Civic codes and full names", () => {
  assert.equal(isCaliforniaState("CA"), true);
  assert.equal(isCaliforniaState("ca"), true);
  assert.equal(isCaliforniaState("California"), true);
  assert.equal(isCaliforniaState("NY"), false);
  assert.equal(isCaliforniaState(""), false);
  assert.equal(isCaliforniaState(undefined), false);
});

void test("skips Civic test election and out-of-state races", () => {
  assert.equal(
    isCaliforniaRelevantElection(
      election({
        id: "2000",
        name: "VIP Test Election",
        electionDay: "2026-12-31",
        ocdDivisionId: "ocd-division/country:us",
      }),
    ),
    false,
  );
  assert.equal(
    isCaliforniaRelevantElection(
      election({
        id: "9000",
        name: "Wyoming Special",
        electionDay: "2026-11-03",
        ocdDivisionId: "ocd-division/country:us/state:wy",
      }),
    ),
    false,
  );
  assert.equal(
    isCaliforniaRelevantElection(
      election({
        id: "5000",
        name: "California Statewide General",
        electionDay: "2026-11-03",
      }),
    ),
    true,
  );
});

void test("pickUpcomingCaliforniaElection uses Civic electionDay, not soonest nationwide", () => {
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);
  const later = new Date();
  later.setDate(later.getDate() + 40);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const picked = pickUpcomingCaliforniaElection([
    election({
      id: "wy",
      name: "Wyoming Special",
      electionDay: iso(soon),
      ocdDivisionId: "ocd-division/country:us/state:wy",
    }),
    election({
      id: "ca",
      name: "California Statewide General",
      electionDay: iso(later),
    }),
    election({
      id: "2000",
      name: "VIP Test Election",
      electionDay: iso(soon),
      ocdDivisionId: "ocd-division/country:us",
    }),
  ]);
  assert.equal(picked?.id, "ca");
});

void test("contestListTitle falls back to Civic ballotTitle", () => {
  assert.equal(
    contestListTitle({ type: "General", office: "Governor" }),
    "Governor",
  );
  assert.equal(
    contestListTitle({
      type: "Referendum",
      ballotTitle: "Measure A",
    }),
    "Measure A",
  );
  assert.equal(contestListTitle({ type: "General" }), "Contest");
});

void test("pollingPlaceSubtitle reads Civic location fields only", () => {
  const loc: PollingLocation = {
    name: "City Hall",
    address: {
      line1: "200 E Santa Clara St",
      city: "San Jose",
      state: "CA",
      zip: "95113",
    },
  };
  assert.equal(pollingPlaceSubtitle([loc]), "City Hall · San Jose");
  assert.equal(pollingPlaceSubtitle([], true), "Mail ballot");
  assert.equal(pollingPlaceSubtitle([]), undefined);
});

void test("earliestEarlyVoteStart uses Civic startDate", () => {
  assert.equal(earliestEarlyVoteStart(undefined), undefined);
  assert.equal(
    earliestEarlyVoteStart([
      {
        address: { line1: "A", city: "X", state: "CA", zip: "1" },
        startDate: "2026-10-20",
      },
      {
        address: { line1: "B", city: "Y", state: "CA", zip: "2" },
        startDate: "2026-10-06",
      },
    ]),
    "2026-10-06",
  );
});
