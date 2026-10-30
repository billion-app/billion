import assert from "node:assert/strict";
import test from "node:test";

import type { PublishedCandidateRace } from "./candidate-race-release";
import { resolveGuideCandidateResearch } from "./guide-candidate-research";

const guide = {
  electionDate: "2026-11-03",
  jurisdiction: "CA" as const,
  candidates: [{ name: "Fiona Ma", officeSlug: "lt-governor" }],
};
const race: PublishedCandidateRace = {
  manifest: {
    id: "10000000-0000-4000-8000-000000000000",
    contestId: "ca-sos:2026-11-03:030000000000",
    electionDate: "2026-11-03",
    jurisdiction: "ocd-division/country:us/state:ca",
    jurisdictionLabel: "California",
    office: "Lieutenant Governor",
    rosterSourceUrl:
      "https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/cert-list-candidates.pdf",
    rosterHash: "a".repeat(64),
    rosterVerifiedAt: "2026-10-30T14:00:00Z",
    rosterVerifiedBy: "source-pipeline",
    members: [
      {
        candidateId: "ca-sos:2026-11-03:030000000000:3550",
        revisionId: "20000000-0000-4000-8000-000000000000",
        name: "Fiona Ma",
        description: null,
        ballotStatus: "on_ballot",
      },
    ],
    policyVersion: "test-policy",
    sourceCheckedAt: "2026-10-30T14:00:00Z",
    expiresAt: "2026-10-31T14:00:00Z",
    currentHashes: {},
  },
  briefs: [],
  reviewedAt: "2026-10-30T14:00:00Z",
};
const input = { name: "Fiona Ma", officeSlug: "lt-governor" as const };

void test("current guide entry resolves to the certified candidate and released race", () => {
  const result = resolveGuideCandidateResearch(guide, [race], input);
  assert.equal(result.status, "published");
  assert.equal(result.releaseId, race.manifest.id);
  assert.deepEqual(result.identity, {
    candidateId: "ca-sos:2026-11-03:030000000000:3550",
    contestId: race.manifest.contestId,
    jurisdiction: race.manifest.jurisdiction,
    electionDate: race.manifest.electionDate,
  });
});

void test("a name alone cannot select a different office, election, or jurisdiction", () => {
  for (const changed of [
    { contestId: "ca-sos:2026-11-03:020000000000" },
    { electionDate: "2028-11-07" },
    { jurisdiction: "ocd-division/country:us/state:nv" },
  ]) {
    const result = resolveGuideCandidateResearch(
      guide,
      [{ ...race, manifest: { ...race.manifest, ...changed } }],
      input,
    );
    assert.equal(result.status, "unavailable");
  }
});

void test("unknown and ambiguous source identities remain unavailable", () => {
  assert.equal(
    resolveGuideCandidateResearch(null, [race], input).status,
    "unavailable",
  );
  assert.equal(
    resolveGuideCandidateResearch(guide, [race], {
      ...input,
      name: "Another person",
    }).status,
    "unavailable",
  );
  assert.equal(
    resolveGuideCandidateResearch(
      guide,
      [
        {
          ...race,
          manifest: {
            ...race.manifest,
            members: [
              ...race.manifest.members,
              ...race.manifest.members.map((member) => ({
                ...member,
                candidateId: "different-candidate",
              })),
            ],
          },
        },
      ],
      input,
    ).status,
    "unavailable",
  );
  assert.equal(
    resolveGuideCandidateResearch(guide, [race, race], input).status,
    "unavailable",
  );
});

void test("unpublished races are not synthesized from the statement guide", () => {
  assert.deepEqual(resolveGuideCandidateResearch(guide, [], input), {
    status: "unavailable",
    reason: "not_published",
  });
});
