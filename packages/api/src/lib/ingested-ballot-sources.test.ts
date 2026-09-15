import assert from "node:assert/strict";
import { test } from "node:test";

import type { VoterInfoResponse } from "./civic";
import type { OfficialGuidePayload } from "./official-guide-cache";
import type { ElectionGuidance } from "./voting-logistics/ca-sos-cache";
import { attachIngestedBallotSources } from "./ingested-ballot-sources";

const ca = "ocd-division/country:us/state:ca";
const sourceUrl = "https://voterguide.sos.ca.gov/propositions/42/";
const ballot: VoterInfoResponse = {
  kind: "test",
  election: {
    id: "dw:ca",
    name: "General",
    electionDay: "2026-11-03",
    ocdDivisionId: ca,
  },
  normalizedInput: { line1: "", city: "", state: "", zip: "" },
  contests: [
    {
      type: "referendum",
      referendumTitle: "Proposition 42",
      district: { name: "California", id: ca },
      summary: "Provider summary",
      citations: [
        {
          field: "summary",
          sourceName: "Provider",
          official: false,
          tier: "ballotpedia",
        },
      ],
    },
    {
      type: "candidate",
      office: "Governor of California",
      district: { name: "California", id: ca },
      candidates: [{ name: "Alex Example" }],
    },
  ],
};
const guide: OfficialGuidePayload = {
  complete: true,
  electionDate: "2026-11-03",
  jurisdiction: "CA",
  fetchedAt: "2026-09-15T12:00:00Z",
  sourceUrl: "https://voterguide.sos.ca.gov/",
  measures: [
    {
      number: "42",
      title: "Official title",
      sourceUrl,
      officialSummary: "Official summary",
      fiscalImpact: "Official fiscal impact",
      fullTextUrl:
        "https://vig.cdn.sos.ca.gov/2026/general/pdf/text-proposed-laws.pdf",
    },
  ],
  candidates: [
    {
      name: "Alex Example",
      officeSlug: "governor",
      statement: "The published candidate statement.",
      sourceUrl:
        "https://voterguide.sos.ca.gov/candidates/governor-candidate-statements.htm",
    },
  ],
};
const guidance: ElectionGuidance = {
  electionDate: "2026-11-03",
  jurisdiction: ca,
  sourceName: "California Secretary of State",
  sourceUrl:
    "https://www.sos.ca.gov/elections/upcoming-elections/general-election-november-3-2026/key-dates-deadlines",
  fetchedAt: "2026-09-15T12:00:00Z",
  checksum: "a".repeat(64),
  coverage: "statewide_guidance_only",
  items: [
    {
      kind: "registration",
      dateText: "October 19, 2026",
      text: "Official registration guidance.",
      links: [],
    },
  ],
};
void test("base ballot receives cited official fields and guidance without modifying provider data", () => {
  const result = attachIngestedBallotSources(ballot, guide, guidance);
  assert.equal(result.contests?.[0]?.summary, "Official summary");
  assert.equal(
    result.contests[0].citations?.find((c) => c.field === "summary")?.sourceUrl,
    sourceUrl,
  );
  assert.equal(
    result.contests[1]?.candidates?.[0]?.statement,
    guide.candidates[0]?.statement,
  );
  assert.equal(
    result.officialVotingGuidance?.coverage,
    "statewide_guidance_only",
  );
  assert.equal(result.pollingLocations, undefined);
  assert.equal(result.mailOnly, undefined);
  assert.equal(ballot.contests?.[0]?.summary, "Provider summary");
});
void test("rejects wrong cycle, partial collection, malformed payload and wrong state", () => {
  for (const value of [
    { ...guide, electionDate: "2026-06-02" },
    { ...guide, complete: false },
    { ...guide, candidates: "bad" },
  ]) {
    assert.equal(
      attachIngestedBallotSources(ballot, value, null).contests?.[0]?.summary,
      "Provider summary",
    );
  }
  assert.equal(
    attachIngestedBallotSources(ballot, guide, {
      ...guidance,
      electionDate: "2026-06-02",
    }).officialVotingGuidance,
    undefined,
  );
  const nc = structuredClone(ballot);
  nc.election.ocdDivisionId = "ocd-division/country:us/state:nc";
  assert.equal(
    attachIngestedBallotSources(nc, guide, guidance).officialVotingGuidance,
    undefined,
  );
  assert.equal(
    attachIngestedBallotSources(nc, guide, guidance).contests?.[0]?.summary,
    "Provider summary",
  );
});
void test("does not join county propositions, unscoped races, ambiguous names, or different offices", () => {
  const local = structuredClone(ballot);
  assert.ok(local.contests?.[0]?.district);
  assert.ok(local.contests[1]);
  local.contests[0].district.id = `${ca}/county:santa_clara`;
  local.contests[1].district = undefined;
  const result = attachIngestedBallotSources(local, guide, guidance);
  assert.equal(result.contests?.[0]?.summary, "Provider summary");
  assert.equal(result.contests[1]?.candidates?.[0]?.statement, undefined);
  const changed = structuredClone(ballot);
  assert.ok(changed.contests?.[1]);
  changed.contests[1].office = "Lieutenant Governor";
  assert.equal(
    attachIngestedBallotSources(changed, guide, null).contests?.[1]
      ?.candidates?.[0]?.statement,
    undefined,
  );
  const duplicate = {
    ...guide,
    candidates: [...guide.candidates, ...guide.candidates],
  };
  assert.equal(
    attachIngestedBallotSources(ballot, duplicate, null).contests?.[1]
      ?.candidates?.[0]?.statement,
    undefined,
  );
  assert.ok(guide.candidates[0]);
  const wrongName = {
    ...guide,
    candidates: [{ ...guide.candidates[0], name: "Alex Other" }],
  };
  assert.equal(
    attachIngestedBallotSources(ballot, wrongName, null).contests?.[1]
      ?.candidates?.[0]?.statement,
    undefined,
  );
});
