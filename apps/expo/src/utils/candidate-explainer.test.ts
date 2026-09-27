import assert from "node:assert/strict";
import test from "node:test";

import {
  candidateKey,
  canMatchCaliforniaGuide,
  checkedCandidateRecord,
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
  assert.equal(
    findGuideCandidate(
      [...candidates, candidates[0]!],
      "Shirley N. Weber",
      "sos",
    ),
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

void test("checked records are source attributed and election scoped", () => {
  const incumbent = checkedCandidateRecord(
    "Shirley N. Weber",
    "sos",
    "2026-11-03",
  );
  const challenger = checkedCandidateRecord(
    "Donald P. (Don) Wagner",
    "sos",
    "2026-11-03",
  );
  assert.match(incumbent?.sourceUrl ?? "", /^https:\/\/www\.sos\.ca\.gov\//);
  assert.match(challenger?.sourceUrl ?? "", /^https:\/\/www\.ocgov\.com\//);
  assert.equal(
    checkedCandidateRecord("Shirley N. Weber", "sos", "2028-11-07"),
    undefined,
  );
  assert.equal(
    checkedCandidateRecord("Shirley N. Weber", "controller", "2026-11-03"),
    undefined,
  );
  assert.equal(
    checkedCandidateRecord("Unknown Person", "sos", "2026-11-03"),
    undefined,
  );
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
