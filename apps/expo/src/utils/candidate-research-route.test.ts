import assert from "node:assert/strict";
import { test } from "node:test";

import {
  currentResearch,
  parseResearchIdentity,
  researchCandidateRoute,
  sameResearchIdentity,
} from "./candidate-research-route";

const identity = {
  candidateId: "person-1",
  contestId: "assembly-27",
  jurisdiction: "ocd-division/country:us/state:ca/sldl:27",
  electionDate: "2026-11-03",
};
test("candidate navigation retains contest identity for duplicate names", () => {
  const first = researchCandidateRoute({ identity, name: "Alex Lee" });
  const second = researchCandidateRoute({
    identity: {
      ...identity,
      contestId: "assembly-28",
      candidateId: "person-2",
    },
    name: "Alex Lee",
  });
  assert.equal(first.pathname, "/candidate-detail");
  assert.deepEqual(
    parseResearchIdentity(first.params.researchIdentity),
    identity,
  );
  const parsedFirst = parseResearchIdentity(first.params.researchIdentity);
  const parsedSecond = parseResearchIdentity(second.params.researchIdentity);
  assert.ok(parsedFirst);
  assert.ok(parsedSecond);
  assert.equal(sameResearchIdentity(parsedFirst, parsedSecond), false);
});
test("malformed canonical links do not become candidate lookups", () => {
  for (const value of [
    "not json",
    "null",
    JSON.stringify({ ...identity, electionDate: "tomorrow" }),
    JSON.stringify({ candidateId: identity.candidateId }),
    "x".repeat(18001),
  ])
    assert.equal(parseResearchIdentity(value), undefined);
});
test("expired research is withdrawn at the expiry boundary even without a refetch", () => {
  const expiry = Date.parse("2026-11-02T12:00:00Z");
  assert.equal(
    currentResearch("2026-11-02T12:00:00Z", expiry - 1, expiry - 1000),
    true,
  );
  assert.equal(
    currentResearch("2026-11-02T12:00:00Z", expiry, expiry - 1000),
    false,
  );
  assert.equal(
    currentResearch("2026-11-02T12:00:00Z", expiry - 1000, expiry + 1),
    false,
  );
  assert.equal(currentResearch("invalid", expiry - 1000, expiry - 1000), false);
});
