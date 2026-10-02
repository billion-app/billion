import assert from "node:assert/strict";
import test from "node:test";

import {
  planStorageKey,
  readPlanMethod,
  registrationCheck,
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
  state[0]!.localJurisdiction.electionAdministrationBody.electionRegistrationConfirmationUrl =
    "javascript:alert(1)";
  assert.equal(registrationCheck({ state })?.url, "https://example.org/state");
  assert.equal(registrationCheck({}), undefined);
});
