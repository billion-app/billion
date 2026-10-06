import assert from "node:assert/strict";
import test from "node:test";

import {
  candidateBriefSchema,
  candidateRaceManifestSchema,
} from "@acme/validators";

import { candidateResearchPreview } from "./fixtures";

function fixture() {
  Object.defineProperty(globalThis, "__DEV__", {
    value: true,
    configurable: true,
  });
  const race = candidateResearchPreview("full");
  assert.ok(race);
  const brief = race.briefs[0];
  assert.ok(brief?.research?.finance);
  return { race, brief, finance: brief.research.finance };
}
void test("the complete and sparse native fixtures validate every source reference", () => {
  const { race } = fixture();
  candidateRaceManifestSchema.parse(race.manifest);
  for (const mode of ["full", "sparse", "withdrawn"]) {
    const value = candidateResearchPreview(mode);
    assert.ok(value);
    for (const brief of value.briefs) candidateBriefSchema.parse(brief);
    assert.equal(value.briefs.length, value.manifest.members.length);
  }
});
void test("production and arbitrary preview parameters cannot expose fictional research", () => {
  Object.defineProperty(globalThis, "__DEV__", {
    value: false,
    configurable: true,
  });
  assert.equal(candidateResearchPreview("full"), null);
  assert.equal(candidateResearchPreview("sparse"), null);
  Object.defineProperty(globalThis, "__DEV__", {
    value: true,
    configurable: true,
  });
  assert.equal(candidateResearchPreview("real"), null);
});
void test("amounts reconcile; campaign claims cannot substantiate reported money", () => {
  const { brief, finance } = fixture();
  assert.ok(finance.receipts);
  finance.receipts.totalCents += 1;
  assert.equal(candidateBriefSchema.safeParse(brief).success, false);
  finance.receipts.totalCents -= 1;
  const source = brief.evidence.find((e) => e.id === "filing");
  assert.ok(source);
  source.origin = "candidate";
  assert.equal(candidateBriefSchema.safeParse(brief).success, false);
});
void test("unknown citations and duplicate promise associations are rejected", () => {
  const { brief } = fixture();
  const promise = brief.research?.promises[0];
  assert.ok(promise);
  promise.brief.authority.evidenceIds = ["missing"];
  assert.equal(candidateBriefSchema.safeParse(brief).success, false);
  promise.brief.authority.evidenceIds = ["powers"];
  brief.research?.promises.push(promise);
  assert.equal(candidateBriefSchema.safeParse(brief).success, false);
});
void test("donor roles and interests are separate; unknowns are never zero", () => {
  const { finance } = fixture();
  const lobbyist = finance.donors[0];
  assert.equal(lobbyist?.type, "individual");
  assert.ok(lobbyist.lobbying);
  assert.deepEqual(lobbyist.interests, []);
  assert.equal(finance.donors[2]?.interests[0]?.area, "foreign_policy");
  const sparse = candidateResearchPreview("sparse");
  assert.equal(sparse?.briefs[0]?.research?.finance, undefined);
});

void test("withdrawal remains roster metadata independent of research coverage", () => {
  fixture();
  const race = candidateResearchPreview("withdrawn");
  assert.equal(race?.manifest.members[1]?.ballotStatus, "withdrawn_on_ballot");
  assert.equal(race.manifest.members.length, 3);
});
