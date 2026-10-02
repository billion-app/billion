import assert from "node:assert/strict";
import test from "node:test";

import {
  hasVotingPlanLogistics,
  planStorageKey,
  readPlanMethod,
  registrationCheck,
  votingPlanAction,
} from "./voting-plan";

const election = { id: "e1", electionDay: "2026-11-03", ocdDivisionId: "ca" };
void test("preferences cannot carry over to another election or jurisdiction", () => {
  const key = planStorageKey(election);
  for (const changed of [
    { ...election, id: "e2" },
    { ...election, electionDay: "2026-06-02" },
    { ...election, ocdDivisionId: "nc" },
  ])
    assert.notEqual(planStorageKey(changed), key);
  assert.equal(readPlanMethod("mail"), "mail");
  assert.equal(readPlanMethod("in-person"), "in-person");
  for (const invalid of [null, "registered", '{"method":"mail"}', ""])
    assert.equal(readPlanMethod(invalid), "undecided");
});
void test("registration action uses the local confirmation service and rejects unsafe URLs", () => {
  const state = [
    {
      name: "State",
      electionAdministrationBody: {
        electionRegistrationConfirmationUrl: "https://example.org/state",
      },
      localJurisdiction: {
        name: "County",
        electionAdministrationBody: {
          name: "County office",
          electionRegistrationConfirmationUrl: "https://example.org/check",
        },
      },
    },
  ];
  assert.deepEqual(registrationCheck({ state }), {
    name: "County office",
    url: "https://example.org/check",
  });
  const region = state[0];
  assert.ok(region);
  region.localJurisdiction.electionAdministrationBody.electionRegistrationConfirmationUrl =
    "javascript:alert(1)";
  assert.equal(registrationCheck({ state })?.url, "https://example.org/state");
  assert.equal(registrationCheck({}), undefined);
});

void test("method handoffs use local purpose links and keep missing facts unknown", () => {
  const data = {
    state: [
      {
        name: "State",
        electionAdministrationBody: {
          absenteeVotingInfoUrl: "https://example.org/state-mail",
        },
        localJurisdiction: {
          name: "County",
          electionAdministrationBody: {
            absenteeVotingInfoUrl: "https://example.org/local-mail",
            votingLocationFinderUrl: "javascript:alert(1)",
          },
        },
      },
    ],
  };
  assert.equal(
    votingPlanAction(data, "absenteeVotingInfoUrl")?.url,
    "https://example.org/local-mail",
  );
  assert.equal(votingPlanAction(data, "votingLocationFinderUrl"), undefined);
  assert.equal(hasVotingPlanLogistics(data), false);
  assert.equal(
    hasVotingPlanLogistics({
      pollingLocations: [
        {
          address: { line1: "Example", city: "Example", state: "CA", zip: "" },
        },
      ],
    }),
    true,
  );
});

void test("unconfirmed provider websites are not promoted to election offices and mail-only facts remain visible", () => {
  assert.equal(
    votingPlanAction(
      {
        state: [
          {
            name: "Provider election",
            sources: [{ name: "Democracy Works", official: false }],
            electionAdministrationBody: {
              electionInfoUrl: "https://example.org/provider",
            },
          },
        ],
      },
      "electionInfoUrl",
    ),
    undefined,
  );
  assert.equal(hasVotingPlanLogistics({ mailOnly: true }), true);
  assert.equal(hasVotingPlanLogistics({ mailOnly: false }), false);
});
