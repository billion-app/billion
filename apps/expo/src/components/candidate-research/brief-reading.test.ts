import assert from "node:assert/strict";
import test from "node:test";

import type { CandidateBrief } from "@acme/validators";

import { readBrief } from "./brief-reading";

function input(): Pick<CandidateBrief, "sections" | "research"> {
  return {
    sections: [
      {
        topic: "record",
        missingEvidence: "Independent corroboration remains unavailable.",
        claims: [
          {
            id: "record-1",
            kind: "analysis",
            text: "The campaign biography describes prior service; the checked passages do not independently corroborate it.",
            evidenceIds: ["biography"],
          },
          {
            id: "record-2",
            kind: "analysis",
            text: "The campaign lists achievements and amounts; these remain campaign assertions.",
            evidenceIds: ["campaign-home"],
          },
        ],
      },
      {
        topic: "mechanisms",
        missingEvidence:
          "The source establishes the budget process, not an adopted budget.",
        claims: [
          {
            id: "mechanisms-1",
            kind: "fact",
            text: "Council approval directs preparation of budget proposals.",
            evidenceIds: ["budget-message", "minutes"],
          },
        ],
      },
      {
        topic: "unknowns",
        missingEvidence: "No additional reviewed evidence is available.",
        claims: [],
      },
    ],
  };
}

void test("campaign Record analyses stay in Record while a general authority fact stays in Mechanisms", () => {
  const source = input();
  const sealed = structuredClone(source);
  const reading = readBrief(source);
  assert.ok(reading.record);
  assert.deepEqual(
    reading.record.claims.map((claim) => [claim.id, claim.kind]),
    [
      ["record-1", "analysis"],
      ["record-2", "analysis"],
    ],
  );
  const authority = reading.chapters.find(
    (section) => section.topic === "mechanisms",
  );
  assert.ok(authority);
  const authorityClaim = authority.claims[0];
  assert.ok(authorityClaim);
  assert.equal(authorityClaim.id, "mechanisms-1");
  assert.equal(authorityClaim.kind, "fact");
  assert.deepEqual(authorityClaim.evidenceIds, ["budget-message", "minutes"]);
  assert.equal(
    reading.record.missingEvidence,
    source.sections[0]?.missingEvidence,
  );
  assert.equal(authority.missingEvidence, source.sections[1]?.missingEvidence);
  assert.equal(
    reading.chapters.find((section) => section.topic === "unknowns")
      ?.missingEvidence,
    source.sections[2]?.missingEvidence,
  );
  assert.deepEqual(source, sealed);
});

void test("a Record headline remains present in its authored chapter", () => {
  const source = input();
  source.research = {
    headlineClaimId: "record-1",
    terms: [],
    promises: [],
    finance: null,
    financeGap: "Fixture finance is unavailable.",
  };
  const reading = readBrief(source);
  assert.equal(reading.headline?.id, "record-1");
  assert(
    reading.record?.claims.some((claim) => claim.id === reading.headline?.id),
  );
});

void test("disputed Record claims and promises outside Priorities retain their topics and IDs", () => {
  const source = input();
  source.sections[0]?.claims.push({
    id: "record-disputed",
    kind: "disputed",
    text: "The supplied accounts differ.",
    evidenceIds: ["account-a", "account-b"],
  });
  source.sections[1]?.claims.push({
    id: "mechanisms-promise",
    kind: "promise",
    text: "Candidate Example proposes a public hearing.",
    evidenceIds: ["statement"],
  });
  const reading = readBrief(source);
  assert.equal(reading.record?.claims.at(-1)?.kind, "disputed");
  assert.equal(
    reading.chapters
      .find((section) => section.topic === "mechanisms")
      ?.claims.at(-1)?.id,
    "mechanisms-promise",
  );
  assert.equal(reading.hasPromises, true);
});

void test("judicial reading retains topic facts and gaps while suppressing campaign promise presentation", () => {
  const source = input();
  source.sections[1]?.claims.push({
    id: "fixture-promise",
    kind: "promise",
    text: "A campaign pledge.",
    evidenceIds: ["statement"],
  });
  const reading = readBrief(source, true);
  assert.equal(reading.headline, undefined);
  assert.equal(reading.hasPromises, false);
  assert.deepEqual(
    reading.chapters
      .find((section) => section.topic === "mechanisms")
      ?.claims.map((claim) => claim.id),
    ["mechanisms-1"],
  );
  assert.equal(reading.record?.claims.length, 2);
  assert.equal(
    reading.chapters.find((section) => section.topic === "unknowns")
      ?.missingEvidence,
    source.sections[2]?.missingEvidence,
  );
});

void test("an omitted headline with no prose leaves the reading summary absent", () => {
  const reading = readBrief({
    sections: [
      {
        topic: "record",
        claims: [],
        missingEvidence: "No reviewed prose claims.",
      },
    ],
  });
  assert.equal(reading.headline, undefined);
  assert.ok(reading.record);
  assert.deepEqual(reading.record.claims, []);
  assert.equal(reading.record.missingEvidence, "No reviewed prose claims.");
});
