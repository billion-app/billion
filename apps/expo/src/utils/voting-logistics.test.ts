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
  sources: [
    { name: "Example county", official: true },
    {
      name: "Community source",
      official: false,
      url: "https://example.org/source",
    },
  ],
};

void test("formats partial addresses and preserves source authority", () => {
  const result = describeVotingLocation(location);
  assert.equal(result.address, "123 Example Street, Example City, NC");
  assert.deepEqual(result.sources, [
    { label: "Example county (official)", url: undefined },
    {
      label: "Community source (official status not confirmed)",
      url: "https://example.org/source",
    },
  ]);
});

void test("missing address and source data stay explicit", () => {
  const result = describeVotingLocation({
    address: { line1: "", city: "", state: "", zip: "" },
  });
  assert.equal(result.address, "Address not supplied.");
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

void test("a shared office destination appears once, with a label covering its purposes", () => {
  const links = votingInformationLinks({
    state: [
      {
        name: "State office",
        electionAdministrationBody: {
          electionRegistrationUrl: "https://example.org/services",
          ballotInfoUrl: "https://example.org/services",
        },
        localJurisdiction: {
          name: "Local office",
          electionAdministrationBody: {
            electionRegistrationUrl: "https://example.org/services",
            votingLocationFinderUrl: "https://example.org/locations",
          },
        },
      },
    ],
  });
  assert.deepEqual(links, [
    {
      label: "Find voting locations",
      office: "Local office",
      url: "https://example.org/locations",
    },
    {
      label: "Election office website",
      office: "Local office",
      url: "https://example.org/services",
    },
  ]);
});

void test("distinct official pages remain available even when labels match", () => {
  const links = votingInformationLinks({
    state: [
      {
        name: "State",
        electionAdministrationBody: {
          ballotInfoUrl: "https://example.org/state-ballot",
        },
        localJurisdiction: {
          name: "County",
          electionAdministrationBody: {
            ballotInfoUrl: "https://example.org/county-ballot",
          },
        },
      },
    ],
  });
  assert.equal(links.length, 2);
  assert.deepEqual(
    links.map((link) => link.office),
    ["County", "State"],
  );
});
