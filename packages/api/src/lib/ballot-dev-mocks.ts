import type { VoterInfoResponse } from "./civic";

/** Explicit synthetic addresses only; never substitutes for real provider failures. */
export function getDevBallot(address: string): VoterInfoResponse | undefined {
  if (
    process.env.NODE_ENV !== "development" ||
    !address.toLowerCase().startsWith("mock:")
  )
    return undefined;
  const scenario = address.slice(5).toLowerCase();
  if (scenario === "error")
    throw new Error("Synthetic ballot provider failure");
  if (!["full", "partial", "empty"].includes(scenario))
    throw new Error("Unknown ballot mock scenario");
  const source = {
    name: "Synthetic development fixture",
    official: false,
    url: "https://example.com",
  };
  const location = {
    name: "Example Community Center (mock)",
    address: {
      line1: "100 Example Street",
      city: "Example City",
      state: "CA",
      zip: "00000",
    },
    pollingHours: "November 3, 7:00 AM–8:00 PM (synthetic)",
    sources: [source],
  };
  const ballot: VoterInfoResponse = {
    kind: "development-fixture",
    submittedAddress: address,
    election: {
      id: "mock-general",
      name: "Example General Election · Mock data",
      electionDay: "2026-11-03",
      ocdDivisionId: "ocd-division/country:us/state:ca",
    },
    normalizedInput: location.address,
    provider: {
      name: "democracy_works",
      sourceUrl: "https://example.com",
      fetchedAt: "2026-09-15T12:00:00Z",
      coverage: "partial",
      addressScope: "address",
      ballotDataStatus: "provided",
      addressNormalization: "unavailable",
      logistics: "lookup_links_only",
    },
    contests: [
      {
        type: "General",
        office: "Example City Council",
        district: { name: "Example City", scope: "citywide" },
        candidates: [
          {
            name: "Alex Example",
            party: "Nonpartisan",
            statement:
              "Synthetic candidate statement: I would prioritize safer crossings, library access and transparent city spending.",
          },
          {
            name: "Jordan Sample",
            party: "Nonpartisan",
            statement:
              "Synthetic candidate statement: My priorities are park maintenance, reliable transit and affordable housing.",
          },
        ],
        sources: [source],
      },
      {
        type: "Referendum",
        referendumTitle: "Measure A · Example Library Funding",
        summary:
          "A fictional measure to fund library repairs and extend opening hours.",
        fiscalImpact: "Synthetic estimate: $2 million annually for ten years.",
        referendumProStatement:
          "Example supporters favor longer opening hours and accessible buildings.",
        referendumConStatement:
          "Example opponents question the cost and prefer existing funding.",
        referendumText:
          "This fictional measure is provided solely to exercise the ballot detail interface.",
        referendumUrl: "https://example.com",
        sources: [source],
      },
    ],
    pollingLocations: [location],
    earlyVoteSites: [
      {
        ...location,
        pollingHours: "October 24–November 2, 9:00 AM–5:00 PM (synthetic)",
      },
    ],
    dropOffLocations: [
      {
        ...location,
        name: "Example Library Drop Box (mock)",
        pollingHours: "Open until November 3 at 8:00 PM (synthetic)",
      },
    ],
    state: [
      {
        name: "California",
        electionAdministrationBody: {
          name: "California Secretary of State",
          electionInfoUrl: "https://www.sos.ca.gov/elections",
          electionRegistrationUrl: "https://registertovote.ca.gov/",
        },
      },
    ],
  };
  if (scenario === "partial") {
    delete ballot.earlyVoteSites;
    delete ballot.dropOffLocations;
    delete ballot.pollingLocations;
    for (const contest of ballot.contests ?? []) {
      delete contest.fiscalImpact;
      delete contest.referendumProStatement;
      delete contest.referendumConStatement;
      for (const candidate of contest.candidates ?? [])
        delete candidate.statement;
    }
  }
  if (scenario === "empty") {
    ballot.contests = [];
    delete ballot.pollingLocations;
    delete ballot.earlyVoteSites;
    delete ballot.dropOffLocations;
    if (ballot.provider) ballot.provider.ballotDataStatus = "unavailable";
  }
  return ballot;
}
