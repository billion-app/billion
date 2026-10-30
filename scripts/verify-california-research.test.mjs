import assert from "node:assert/strict";
import test from "node:test";

import {
  checkRace,
  expectedRoster,
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
