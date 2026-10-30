import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  checkRace,
  expectedRoster,
  finalScopeErrors,
  walkCatalog,
} from "./verify-california-research.mjs";

const identity = (id) => ({
  candidateId: id,
  contestId: "race",
  jurisdiction: "CA",
  electionDate: "2026-11-03",
});
const page = (ids, nextCursor = null) => ({
  snapshotId: "snapshot",
  totalMatches: 3,
  coverage: { expectedCandidates: 3 },
  items: ids.map((id) => ({ identity: identity(id) })),
  nextCursor,
});

test("walks beyond a first page and retains every canonical identity", async () => {
  const calls = [];
  const result = await walkCatalog(
    async (_, input) => {
      calls.push(input.cursor);
      return input.cursor ? page(["c"]) : page(["a", "b"], "next");
    },
    "2026-11-03",
    2,
  );
  assert.deepEqual(
    result.items.map((item) => item.identity.candidateId),
    ["a", "b", "c"],
  );
  assert.deepEqual(calls, [undefined, "next"]);
});

test("rejects truncation, duplicate identities, changing snapshots, and cursor cycles", async () => {
  await assert.rejects(
    walkCatalog(async () => page(["a"]), "2026-11-03"),
    /truncated/,
  );
  let count = 0;
  await assert.rejects(
    walkCatalog(
      async () => (++count === 1 ? page(["a"], "next") : page(["a", "b"])),
      "2026-11-03",
    ),
    /Duplicate/,
  );
  count = 0;
  await assert.rejects(
    walkCatalog(
      async () =>
        ++count === 1
          ? page(["a"], "next")
          : { ...page(["b", "c"]), snapshotId: "changed" },
      "2026-11-03",
    ),
    /changed snapshot/,
  );
  count = 0;
  await assert.rejects(
    walkCatalog(async () => page([String(++count)], "same"), "2026-11-03"),
    /cursor cycle/,
  );
});

test("authoritative identity comparison retains jurisdiction and rejects duplicate roster identities", () => {
  const a = { identity: identity("a"), name: "A" };
  const document = {
    electionDate: "2026-11-03",
    races: [
      {
        officeFamily: "local",
        members: [
          a,
          { ...a, identity: { ...a.identity, jurisdiction: "San Jose" } },
        ],
      },
    ],
  };
  assert.equal(expectedRoster(document).candidates.length, 2);
  assert.throws(
    () => expectedRoster({ ...document, races: [{ members: [a, a] }] }),
    /duplicate/,
  );
});

test("judicial research needs cited record or authority, not an invented promise", () => {
  const candidateIdentity = identity("ca-sos:2026-11-03:140000000000:1");
  const source = {
    id: "court",
    url: "https://courts.ca.gov/justice",
    publisher: "Court",
    locator: "Biography",
    contentHash: "hash",
    excerpt: "Served on court",
    retrievedAt: "2026-10-29T22:00:00Z",
  };
  const evidenceKey = JSON.stringify([
    JSON.stringify([
      candidateIdentity.jurisdiction,
      candidateIdentity.electionDate,
      candidateIdentity.contestId,
      candidateIdentity.candidateId,
    ]),
    source.id,
  ]);
  const race = {
    manifest: {
      id: "release",
      contestId: "race",
      jurisdiction: "CA",
      electionDate: "2026-11-03",
      policyVersion: "approved-v1",
      rosterSnapshotId: "snapshot",
      rosterSourceUrl: "https://sos.ca.gov/roster",
      rosterHash: "hash",
      rosterVerifiedBy: "official",
      sourceCheckedAt: "2026-10-29T22:00:00Z",
      rosterVerifiedAt: "2026-10-29T22:00:00Z",
      expiresAt: "2026-10-30T22:00:00Z",
      members: [
        { candidateId: candidateIdentity.candidateId, revisionId: "revision" },
      ],
      currentHashes: { [evidenceKey]: "hash" },
    },
    reviewedAt: "2026-10-29T22:00:00Z",
    briefs: [
      {
        identity: candidateIdentity,
        revisionId: "revision",
        evidence: [source],
        research: {
          promises: [],
          finance: null,
          financeGap: "No campaign finance filings established.",
        },
        sections: [
          {
            topic: "record",
            claims: [{ text: "Served on court", evidenceIds: ["court"] }],
          },
        ],
      },
    ],
  };
  const expected = [
    { identity: candidateIdentity, officeFamily: "judicial_retention" },
  ];
  const context = {
    now: Date.parse("2026-10-30T12:00:00Z"),
    snapshotId: "snapshot",
    policyVersion: "approved-v1",
  };
  const valid = checkRace(race, expected, context);
  assert.deepEqual(valid.issues, []);
  assert.deepEqual(valid.briefs[0].errors, []);
  const stale = structuredClone(race);
  stale.manifest.currentHashes[evidenceKey] = "changed";
  assert.match(
    checkRace(stale, expected, context).briefs[0].errors.join(" "),
    /hash not current/,
  );
  const filler = structuredClone(race);
  filler.briefs[0].evidence[0].url = filler.manifest.rosterSourceUrl;
  filler.briefs[0].research.financeGap = null;
  const errors = checkRace(filler, expected, context).briefs[0].errors.join(
    " ",
  );
  assert.match(errors, /Roster-only/);
  assert.match(errors, /Finance unavailable/);
});

function completeSanJoseFixture() {
  const text = "Archived official county roster and territorial proof.";
  const contentHash = createHash("sha256").update(text).digest("hex");
  const proof = {
    contentHash,
    url: "https://files.santaclaracounty.gov/official-source",
  };
  const jurisdiction = "ocd-division/country:us/state:ca/place:san_jose";
  const localIdentity = {
    ...identity("ca-scc:5205:1"),
    contestId: "ca-scc:5205",
    jurisdiction,
  };
  const member = {
    identity: localIdentity,
    name: "Local Candidate",
    sourceProof: proof,
  };
  const entries = Array.from({ length: 129 }, (_, index) =>
    index === 0
      ? {
          jurisdiction,
          proofs: [proof],
          reason: "Official territory serves San Jose",
          sourceContestId: "5205",
          status: "include",
        }
      : {
          proofs: [proof],
          reason: "Official territory is outside the selected scope",
          sourceContestId: String(6000 + index),
          status: "exclude",
        },
  );
  const localCrosswalk = {
    electionDate: "2026-11-03",
    entries,
    method:
      "Reviewed every county contest against official territorial sources",
    rosterSourceHash: contentHash,
    schemaVersion: 1,
  };
  localCrosswalk.review = {
    actorId: "independent-reviewer",
    digest: createHash("sha256")
      .update(JSON.stringify(localCrosswalk))
      .digest("hex"),
    reviewedAt: "2026-10-30T00:00:00Z",
  };
  return {
    electionDate: "2026-11-03",
    scope: "ca_sos_certified_and_san_jose",
    localCoverage: {
      scope: "san_jose",
      status: "verified",
      expectedCandidates: 1,
      expectedRaces: 1,
      pendingRaces: 0,
      pendingCandidates: 0,
    },
    localCrosswalk,
    additionalSources: [{ ...proof, text }],
    races: [
      {
        officeFamily: "statewide",
        members: Array.from({ length: 388 }, (_, index) => ({
          name: `State ${index}`,
          identity: identity(`ca-sos:${index}`),
        })),
      },
      {
        officeFamily: "local",
        contestId: localIdentity.contestId,
        sourceContestId: "5205",
        jurisdiction,
        members: [member],
        sourceProof: proof,
      },
    ],
  };
}

test("complete reviewed San Jose scope passes independently of other county coverage", () => {
  const snapshot = completeSanJoseFixture();
  snapshot.countyCoverage = [{ name: "Alameda", status: "not_enumerated" }];
  const roster = expectedRoster(snapshot);
  assert.equal(roster.candidates.length, 389);
  assert.deepEqual(finalScopeErrors(roster), []);
});

test("publishing every listed member of a pending San Jose subset cannot satisfy final scope", () => {
  const snapshot = completeSanJoseFixture();
  snapshot.localCoverage = {
    ...snapshot.localCoverage,
    status: "pending",
    expectedCandidates: null,
    expectedRaces: null,
    pendingRaces: 10,
    pendingCandidates: 25,
  };
  const allListedPublished = expectedRoster(snapshot).candidates.map(
    (candidate) => ({ ...candidate, status: "published" }),
  );
  const errors = finalScopeErrors({
    ...expectedRoster(snapshot),
    candidates: allListedPublished,
  });
  assert.match(errors.join(" "), /not verified complete/);
  assert.match(errors.join(" "), /unresolved candidate identities/);
});

test("an unrelated local candidate and manual identity list cannot substitute for verified San Jose scope", () => {
  const unrelated = completeSanJoseFixture();
  const race = unrelated.races[1];
  race.jurisdiction = "ocd-division/country:us/state:ca/place:cupertino";
  race.members[0].identity.jurisdiction = race.jurisdiction;
  assert.match(
    finalScopeErrors(expectedRoster(unrelated)).join(" "),
    /outside verified San Jose scope/,
  );
  const manual = {
    electionDate: "2026-11-03",
    members: completeSanJoseFixture()
      .races.flatMap((item) => item.members)
      .map((member) => ({ ...member, contestId: member.identity.contestId })),
  };
  assert.ok(finalScopeErrors(expectedRoster(manual)).length > 0);
});

test("verified labels cannot hide missing, pending, tampered, or unmapped local proof", () => {
  for (const mutate of [
    (snapshot) => {
      delete snapshot.localCoverage.pendingCandidates;
    },
    (snapshot) => {
      snapshot.localCrosswalk.entries[1].status = "pending";
    },
    (snapshot) => {
      snapshot.localCrosswalk.review.digest = "forged";
    },
    (snapshot) => {
      snapshot.additionalSources[0].text = "changed source";
    },
    (snapshot) => {
      delete snapshot.races[1].members[0].sourceProof;
    },
  ]) {
    const snapshot = completeSanJoseFixture();
    mutate(snapshot);
    assert.ok(finalScopeErrors(expectedRoster(snapshot)).length > 0);
  }
});
