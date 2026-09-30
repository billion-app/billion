import assert from "node:assert/strict";
import test from "node:test";

import {
  candidateKey,
  canMatchCaliforniaGuide,
  findGuideCandidate,
  guideCandidateRoute,
  isOfficeSlug,
  parseBallotCandidate,
  statewideOfficeSlug,
} from "./candidate-explainer";

void test("guide identity requires exact office and a unique candidate", () => {
  const candidates = [
    {
      name: "Shirley N. Weber",
      officeSlug: "sos",
      sourceUrl:
        "https://voterguide.sos.ca.gov/candidates/sos-candidate-statements.htm",
    },
    {
      name: "Shirley N. Weber",
      officeSlug: "controller",
      sourceUrl: "https://example.org/other",
    },
  ];
  assert.equal(
    findGuideCandidate(candidates, " Shirley N. Weber ", "sos"),
    candidates[0],
  );
  assert.equal(
    findGuideCandidate(candidates, "Shirley N. Weber", "governor"),
    undefined,
  );
  const first = candidates[0];
  assert.ok(first);
  assert.equal(
    findGuideCandidate([...candidates, first], "Shirley N. Weber", "sos"),
    undefined,
  );
  assert.notEqual(
    candidateKey("Shirley N. Weber", "sos"),
    candidateKey("Shirley N. Weber", "controller"),
  );
  assert.deepEqual(guideCandidateRoute("Shirley N. Weber", "sos"), {
    pathname: "/candidate-detail",
    params: { name: "Shirley N. Weber", office: "sos" },
  });
});

void test("unknown office does not acquire a description", () => {
  assert.equal(isOfficeSlug("sos"), true);
  assert.equal(isOfficeSlug("random-office"), false);
  assert.equal(statewideOfficeSlug("California Secretary of State"), "sos");
  assert.equal(statewideOfficeSlug("City Clerk"), undefined);
});

void test("guide joining requires authoritative California statewide district", () => {
  const statewide = "ocd-division/country:us/state:ca";
  assert.equal(canMatchCaliforniaGuide("CA", "2026-11-03", statewide), true);
  assert.equal(
    canMatchCaliforniaGuide(
      "CA",
      "2026-11-03",
      "ocd-division/country:us/state:ca/place:somewhere",
    ),
    false,
  );
  assert.equal(canMatchCaliforniaGuide("CA", "2026-11-03", undefined), false);
  assert.equal(canMatchCaliforniaGuide("NV", "2026-11-03", statewide), false);
  assert.equal(canMatchCaliforniaGuide("CA", "2028-11-07", statewide), false);
});

void test("route candidate parsing rejects mismatches and malformed fields", () => {
  assert.equal(parseBallotCandidate('{"name":"Jane"}', "Other"), undefined);
  assert.equal(parseBallotCandidate("{bad", "Jane"), undefined);
  const candidate = parseBallotCandidate(
    JSON.stringify({
      name: "Jane",
      statement: 7,
      party: { value: "A" },
      citations: {},
      ballotStatus: "writeIn",
    }),
    "Jane",
  );
  assert.deepEqual(candidate, {
    name: "Jane",
    party: undefined,
    statement: undefined,
    photoUrl: undefined,
    ballotStatus: undefined,
    citations: undefined,
  });
});
