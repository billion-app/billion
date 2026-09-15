import assert from "node:assert/strict";
import test from "node:test";

import type { PollingLocation } from "@acme/api";

import {
  describeVotingLocation,
  votingInformationLinks,
  votingLocationGroups,
  votingWebUrl,
} from "./voting-logistics";

const location: PollingLocation = {
  address: {
    line1: "123 Example Street",
    city: "Example City",
    state: "NC",
    zip: "",
  },
  pollingHours: "Mon–Fri 9–5; Saturday 10–2",
  startDate: "2026-10-15",
  endDate: "2026-10-31",
  notes: "Use the accessible side entrance. Bring required identification.",
  voterServices: "Early voting",
  sources: [
    { name: "Example county", official: true },
    {
      name: "Community source",
      official: false,
      url: "https://example.org/source",
    },
  ],
};

void test("preserves all supplied date, hours, notes, services and source details", () => {
  const result = describeVotingLocation(location);
  assert.equal(result.address, "123 Example Street, Example City, NC");
  assert.deepEqual(result.details, [
    `Hours: ${location.pollingHours}`,
    "Starts: 2026-10-15",
    "Ends: 2026-10-31",
    `Notes: ${location.notes}`,
    "Services: Early voting",
  ]);
  assert.deepEqual(result.sources, [
    { label: "Example county (official)", url: undefined },
    {
      label: "Community source (official status not confirmed)",
      url: "https://example.org/source",
    },
  ]);
});

void test("partial address and end-only dates do not acquire invented values", () => {
  const result = describeVotingLocation({
    address: { line1: "", city: "", state: "", zip: "" },
    endDate: "2026-11-03",
  });
  assert.equal(result.address, "Address not supplied.");
  assert.deepEqual(result.details, ["Hours not supplied.", "Ends: 2026-11-03"]);
  assert.deepEqual(result.sources, []);
});

void test("missing groups stay separate, including for mail-only precincts", () => {
  for (const mailOnly of [true, false, undefined]) {
    const groups = votingLocationGroups({
      mailOnly,
      earlyVoteSites: [location],
    });
    assert.deepEqual(
      groups.map((group) => group.locations.length),
      [0, 1, 0],
    );
    assert.equal(groups[1]?.locations[0], location);
  }
  assert.deepEqual(
    votingLocationGroups({}).map((group) => group.locations),
    [[], [], []],
  );
});

void test("official links include local and state offices and never registration status", () => {
  const links = votingInformationLinks({
    state: [
      {
        name: "North Carolina",
        electionAdministrationBody: {
          electionRegistrationUrl: "https://example.org/register",
          electionRegistrationConfirmationUrl:
            "https://example.org/private-status",
          ballotInfoUrl: "javascript:alert(1)",
        },
        localJurisdiction: {
          name: "Example county",
          electionAdministrationBody: {
            name: "County election office",
            absenteeVotingInfoUrl: "https://example.org/mail",
            ballotInfoUrl: "https://example.org/ballot",
          },
        },
      },
    ],
  });
  assert.deepEqual(
    links.map((link) => link.label),
    [
      "Absentee and mail voting information",
      "Ballot information",
      "Registration information",
    ],
  );
  assert.equal(links[0]?.office, "County election office");
  assert.equal(links[2]?.office, "North Carolina");
  assert.deepEqual(votingInformationLinks({}), []);
});

void test("unsafe and credential-bearing source URLs are not actionable", () => {
  for (const value of [
    undefined,
    "",
    "javascript:alert(1)",
    "file:///tmp/test",
    "tel:123",
    "https://user:secret@example.org",
    "invalid",
  ])
    assert.equal(votingWebUrl(value), undefined);
  assert.equal(
    votingWebUrl(" https://example.org/vote "),
    "https://example.org/vote",
  );
  assert.equal(
    votingWebUrl("http://example.org/vote"),
    "http://example.org/vote",
  );
});
