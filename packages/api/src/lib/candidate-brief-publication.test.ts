import assert from "node:assert/strict";
import test from "node:test";

import { candidateBriefSchema } from "@acme/validators";

import type { PublicationContext } from "./candidate-brief-publication";
import {
  briefDigest,
  briefIdentityKey,
  publishableRace,
} from "./candidate-brief-publication";

function required<T>(value: T | undefined): T {
  assert.ok(value);
  return value;
}

function fixture(candidateId = "incumbent") {
  return candidateBriefSchema.parse({
    schemaVersion: 1,
    identity: {
      candidateId,
      contestId: "fixture-race",
      electionDate: "2026-11-03",
      jurisdiction: "fixture:ca",
    },
    revisionId:
      candidateId === "incumbent"
        ? "00000000-0000-4000-8000-000000000001"
        : "00000000-0000-4000-8000-000000000002",
    supersedes: null,
    createdAt: "2026-10-01T00:00:00Z",
    authorId: "writer",
    authorship: { kind: "human" },
    correction: null,
    evidence:
      candidateId === "incumbent"
        ? [
            {
              id: "record",
              url: "https://example.org/fixture",
              publisher: "Synthetic fixture",
              locator: "Section 1",
              retrievedAt: "2026-10-01T00:00:00Z",
              documentDate: null,
              contentHash: "a".repeat(64),
              excerpt: "Fixture public record",
              origin: "primary_record",
            },
          ]
        : [],
    sections: [
      "priorities",
      "record",
      "mechanisms",
      "effects",
      "tradeoffs",
      "unknowns",
    ].map((topic) => ({
      topic,
      missingEvidence:
        "No verified evidence in this synthetic fixture; not negative evidence.",
      claims:
        topic === "record" && candidateId === "incumbent"
          ? [
              {
                id: "claim",
                kind: "fact",
                text: "Synthetic record example",
                evidenceIds: ["record"],
              },
            ]
          : [],
    })),
  });
}
const briefs = [fixture(), fixture("challenger")];
function context(): PublicationContext {
  return {
    policy: { approved: true, version: "proposal-v1" },
    roster: { verified: true, candidateIds: ["incumbent", "challenger"] },
    reviews: briefs.map((b) => ({
      candidateId: b.identity.candidateId,
      revisionDigest: briefDigest(b),
      reviewerId: "editor",
      reviewedAt: "2026-10-02T00:00:00Z",
      policyVersion: "proposal-v1",
    })),
    currentHashes: { record: "a".repeat(64) },
    withdrawnRevisionIds: [],
    now: "2026-10-02T12:00:00Z",
  };
}
void test("bounded incumbent and sparse non-incumbent fixtures publish only as a full reviewed race", () => {
  assert.equal(publishableRace(briefs, context()).status, "published");
  assert.equal(
    publishableRace([briefs[0]], context()).status,
    "incomplete_race",
  );
});
void test("policy, source refresh and withdrawal fail closed", () => {
  const c = context();
  c.policy.approved = false;
  assert.equal(publishableRace(briefs, c).status, "policy_pending");
  c.policy.approved = true;
  c.currentHashes.record = "b".repeat(64);
  assert.equal(publishableRace(briefs, c).status, "stale");
  c.currentHashes.record = "a".repeat(64);
  c.withdrawnRevisionIds = [required(briefs[0]).revisionId];
  assert.equal(publishableRace(briefs, c).status, "withdrawn");
});
void test("changed prose and self-review invalidate approvals", () => {
  const changed = structuredClone(briefs);
  required(required(required(changed[0]).sections[1]).claims[0]).text =
    "Changed claim";
  assert.equal(publishableRace(changed, context()).status, "review_pending");
  const c = context();
  required(c.reviews[0]).reviewerId = "writer";
  assert.equal(publishableRace(briefs, c).status, "review_pending");
});
void test("same names cannot collide across election/contest identity", () => {
  const a = fixture().identity;
  assert.notEqual(
    briefIdentityKey(a),
    briefIdentityKey({ ...a, contestId: "another-race" }),
  );
});
void test("unknown citations, duplicate topics and unsupported fact evidence rejected", () => {
  const b = fixture();
  required(required(b.sections[1]).claims[0]).evidenceIds = ["missing"];
  assert.equal(candidateBriefSchema.safeParse(b).success, false);
  const d = fixture();
  required(d.sections[0]).topic = "record";
  assert.equal(candidateBriefSchema.safeParse(d).success, false);
  const e = fixture();
  required(e.evidence[0]).origin = "candidate";
  assert.equal(candidateBriefSchema.safeParse(e).success, false);
});
void test("correction identifies prior revision; old approval does not approve successor", () => {
  const corrected = structuredClone(briefs);
  const b = required(corrected[0]);
  b.supersedes = b.revisionId;
  b.correction = {
    reason: "Synthetic correction to record claim",
    previousRevisionId: b.revisionId,
  };
  b.revisionId = "00000000-0000-4000-8000-000000000003";
  assert.equal(candidateBriefSchema.safeParse(b).success, true);
  assert.equal(publishableRace(corrected, context()).status, "review_pending");
});
