import assert from "node:assert/strict";
import test from "node:test";

import { californiaRosterSnapshotSchema } from "@acme/validators";

import type { PublishedCandidateRace } from "./candidate-race-release";
import {
  californiaCandidateCatalog,
  resolveRosterCandidate,
  rosterCandidateMetadata,
  rosterPublishedRaces,
} from "./california-catalog";

const electionDate = "2026-11-03";
const jurisdiction = "ocd-division/country:us/state:ca";
const snapshot = californiaRosterSnapshotSchema.parse({
  schemaVersion: 1,
  id: "a".repeat(64),
  electionDate,
  scope: "ca_sos_certified",
  scopeLabel:
    "State-certified roster. County and city races are not enumerated.",
  source: {
    url: "https://example.org/feed",
    byteHash: "a".repeat(64),
    textHash: "b".repeat(64),
    fetchedAt: "2026-10-30T00:00:00Z",
    encoding: "windows-1252",
    text: "fixture",
  },
  certification: {
    url: "https://example.org/certified",
    textHash: "c".repeat(64),
    fetchedAt: "2026-10-30T00:00:00Z",
    text: "fixture",
  },
  races: Array.from({ length: 228 }, (_, index) => ({
    raceKey: `race-${index}`,
    contestId: `contest-${index}`,
    jurisdiction,
    jurisdictionLabel: `District ${index}`,
    electionDate,
    sourceContestId: String(index),
    officeFamily: index < 64 ? "judicial_retention" : "state_assembly",
    office: index < 64 ? `Justice seat ${index}` : `Assembly District ${index}`,
    district: String(index),
    kind: index < 64 ? "retention" : "election",
    rosterDigest: "b".repeat(64),
    members: [
      {
        identity: {
          candidateId: `candidate-${index}`,
          contestId: `contest-${index}`,
          jurisdiction,
          electionDate,
        },
        candidateId: `candidate-${index}`,
        name: `Candidate ${String(index).padStart(3, "0")}`,
        sourceCandidateId: String(index),
        partyCode: "",
        party: null,
        ballotStatus: "on_ballot",
      },
    ],
  })),
  excludedContests: [],
  countyCoverage: [],
});
void test("authoritative catalog pages all 228 races with global search and stable counts", () => {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = californiaCandidateCatalog(snapshot, [], {
      electionDate,
      cursor,
      limit: 20,
    });
    assert.equal(page.totalMatches, 228);
    assert.equal(page.coverage.expectedRaces, 228);
    assert.equal(page.coverage.publishedCandidates, 0);
    assert.equal(page.coverage.countyCoverage.status, "incomplete");
    ids.push(...page.items.map((item) => item.identity.candidateId));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  assert.equal(ids.length, 228);
  assert.equal(new Set(ids).size, 228);
  assert.deepEqual(
    californiaCandidateCatalog(snapshot, [], {
      electionDate,
      query: "Candidate 227",
    }).items.map((item) => item.identity.candidateId),
    ["candidate-227"],
  );
  assert.equal(
    californiaCandidateCatalog(snapshot, [], {
      electionDate,
      officeFamily: "judicial_retention",
    }).totalMatches,
    64,
  );
});
void test("catalog rejects old snapshot cursors instead of mixing roster generations", () => {
  const page = californiaCandidateCatalog(snapshot, [], {
    electionDate,
    limit: 1,
  });
  assert.throws(
    () =>
      californiaCandidateCatalog({ ...snapshot, id: "d".repeat(64) }, [], {
        electionDate,
        cursor: page.nextCursor ?? undefined,
      }),
    /previous roster snapshot/,
  );
});
void test("provider-context identity resolution requires full unique office and election context", () => {
  const target = snapshot.races[227];
  assert.ok(target);
  const member = target.members[0];
  assert.ok(member);
  assert.deepEqual(
    resolveRosterCandidate(snapshot, {
      name: " Candidate 227 ",
      office: target.office,
      jurisdiction,
      electionDate,
    }),
    member.identity,
  );
  assert.equal(
    resolveRosterCandidate(snapshot, {
      name: "Candidate 227",
      office: "Assembly",
      jurisdiction,
      electionDate,
    }),
    null,
  );
  assert.equal(
    resolveRosterCandidate(snapshot, {
      name: "Candidate 227",
      office: target.office,
      jurisdiction,
      electionDate: "2024-11-05",
    }),
    null,
  );
});
void test("changed authoritative membership hides an old published race", () => {
  const target = snapshot.races[0];
  assert.ok(target);
  const old = {
    manifest: {
      contestId: target.contestId,
      jurisdiction,
      electionDate,
      members: [{ candidateId: "not-current" }],
    },
  } as PublishedCandidateRace;
  assert.deepEqual(rosterPublishedRaces(snapshot, [old]), []);
  assert.equal(
    californiaCandidateCatalog(snapshot, [old], { electionDate }).coverage
      .publishedCandidates,
    0,
  );
});

void test("family counts follow query before office filter and cursors bind filters", () => {
  const page = californiaCandidateCatalog(snapshot, [], {
    electionDate,
    query: "Candidate 0",
    officeFamily: "judicial_retention",
    limit: 1,
  });
  assert.equal(page.totalMatches, 64);
  assert.equal(
    page.families.find((family) => family.value === "state_assembly")?.count,
    36,
  );
  assert.equal(
    page.families.find((family) => family.value === "local")?.count,
    0,
  );
  assert.throws(
    () =>
      californiaCandidateCatalog(snapshot, [], {
        electionDate,
        cursor: page.nextCursor ?? undefined,
      }),
    /cursor is invalid/,
  );
});

void test("candidate metadata preserves the authoritative identity and local source proof", () => {
  const race = snapshot.races[0];
  assert.ok(race);
  const member = race.members[0];
  assert.ok(member);
  const local = {
    ...snapshot,
    races: [
      {
        ...race,
        officeFamily: "local" as const,
        rosterSourceUrl: "https://example.org/city-roster",
      },
    ],
  };
  const metadata = rosterCandidateMetadata(local, member.identity);
  assert.equal(metadata?.rosterSourceUrl, "https://example.org/city-roster");
  assert.deepEqual(metadata.identity, member.identity);
  assert.equal(
    rosterCandidateMetadata(local, {
      ...member.identity,
      candidateId: "absent",
    }),
    null,
  );
});
