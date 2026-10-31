import assert from "node:assert/strict";
import test from "node:test";

import type { PublicCaliforniaRoster } from "./california-public-roster";
import type { VoterInfoResponse } from "./civic";
import {
  BALLOT_RESEARCH_DEMAND_ENDPOINT,
  ballotResearchDemand,
  demandedRosterRaceKeys,
  readDemandedRosterRaceKeys,
  recordBallotResearchDemand,
  requestOperatorResearch,
} from "./ballot-research-demand";

const now = new Date("2026-10-31T16:00:00Z");
const ballot: VoterInfoResponse = {
  kind: "democracy-works#voterInfoResponse",
  submittedAddress: "PRIVATE ADDRESS",
  normalizedInput: { line1: "PRIVATE", city: "", state: "", zip: "" },
  election: {
    id: "dw:nov",
    name: "General",
    electionDay: "2026-11-03",
    ocdDivisionId: "ocd-division/country:us/state:ca",
  },
  provider: {
    name: "democracy_works",
    fetchedAt: now.toISOString(),
    coverage: "partial",
    addressScope: "address",
    ballotDataStatus: "provided",
    addressNormalization: "unavailable",
    logistics: "lookup_links_only",
  },
  contests: [
    {
      type: "candidate",
      office: "U.S. House",
      district: { id: "ocd-division/country:us/state:ca/cd:19", name: "19" },
      providerIdentity: { provider: "democracy_works", contestId: "dw:19" },
      candidates: [
        {
          name: "First Person",
          ballotStatus: "onBallot",
          providerIdentity: {
            provider: "democracy_works",
            candidateId: "dw:first",
          },
        },
        {
          name: "Second Person",
          ballotStatus: "withdrewStillOnBallot",
          providerIdentity: {
            provider: "democracy_works",
            candidateId: "dw:second",
          },
        },
      ],
    },
  ],
};
const races = [19, 16].map((district) => ({
  raceKey: `house-${district}`,
  contestId: `canonical-${district}`,
  electionDate: "2026-11-03",
  jurisdiction: `ocd-division/country:us/state:ca/cd:${district}`,
  district: String(district),
  office: "U.S. House",
  officeFamily: "us_house",
  members: [
    { name: "First Person", ballotStatus: "on_ballot" },
    { name: "Second Person", ballotStatus: "withdrawn_on_ballot" },
    { name: "Qualified Write-in", ballotStatus: "qualified_write_in" },
  ],
}));
const snapshot = {
  electionDate: "2026-11-03",
  races,
} as PublicCaliforniaRoster;
const contest = ballot.contests?.[0];
const provider = ballot.provider;
const [race19, race16] = races;
const canonicalRace = snapshot.races[0];
assert.ok(contest && provider && race19 && race16 && canonicalRace);
const candidates = contest.candidates;
const [firstMember, secondMember] = canonicalRace.members;
assert.ok(candidates && firstMember && secondMember);

void test("trusted address ballot selects one whole authoritative race and keeps addresses out of demand", () => {
  const demands = ballotResearchDemand(ballot, now);
  assert.equal(demands.length, 1);
  assert.deepEqual(
    demandedRosterRaceKeys(snapshot, [...demands, ...demands], now),
    ["house-19"],
  );
  assert.equal(JSON.stringify(demands).includes("PRIVATE"), false);
  assert.equal(demands[0]?.candidates.length, 2);
  assert.equal(snapshot.races[0]?.members.length, 3);
});
void test("unknown, statewide-only, unavailable, stale and future provider ballots admit no work", () => {
  for (const patch of [
    { addressScope: "unknown" },
    { addressScope: "statewide_only" },
    { ballotDataStatus: "unavailable" },
    { fetchedAt: "2026-10-30T15:59:59Z" },
    { fetchedAt: "2026-10-31T16:00:01Z" },
  ]) {
    assert.deepEqual(
      ballotResearchDemand(
        {
          ...ballot,
          provider: { ...provider, ...patch },
        } as VoterInfoResponse,
        now,
      ),
      [],
    );
  }
  assert.deepEqual(
    ballotResearchDemand({ ...ballot, provider: undefined }, now),
    [],
  );
});
void test("candidate lookup fields cannot admit partial or inconsistent contest identities", () => {
  for (const change of [
    { office: "Different office" },
    { district: { id: race19.jurisdiction, name: "16" } },
    {
      candidates: [
        ...candidates,
        {
          name: "Wrong Person",
          ballotStatus: "onBallot" as const,
          providerIdentity: {
            provider: "democracy_works" as const,
            candidateId: "wrong",
          },
        },
      ],
    },
  ]) {
    const changed: VoterInfoResponse = {
      ...ballot,
      contests: [{ ...contest, ...change }],
    };
    assert.deepEqual(
      demandedRosterRaceKeys(snapshot, ballotResearchDemand(changed, now), now),
      [],
    );
  }
  assert.deepEqual(
    demandedRosterRaceKeys(
      snapshot,
      ballotResearchDemand(
        {
          ...ballot,
          contests: [
            {
              ...contest,
              candidates: candidates.slice(0, 1),
            },
          ],
        },
        now,
      ),
      now,
    ),
    [],
  );
  assert.deepEqual(
    demandedRosterRaceKeys(
      { ...snapshot, electionDate: "2028-11-07" },
      ballotResearchDemand(ballot, now),
      now,
    ),
    [],
  );
  assert.deepEqual(
    demandedRosterRaceKeys(
      { ...snapshot, races: [...snapshot.races, canonicalRace] },
      ballotResearchDemand(ballot, now),
      now,
    ),
    [],
  );
});
void test("provider contract district labels match actual canonical CA19 metadata without broadening districts", () => {
  const canonical = {
    ...snapshot,
    races: [
      {
        ...canonicalRace,
        office: "United States Representative District 19",
        members: [
          { ...firstMember, name: "Peter Coe Verbica" },
          { ...secondMember, name: "Jimmy Panetta" },
        ],
      },
    ],
  };
  const provider = {
    ...ballot,
    contests: [
      {
        ...contest,
        district: {
          id: race19.jurisdiction,
          name: "California Congressional District 19",
        },
        candidates: candidates.map((candidate, index) => ({
          ...candidate,
          name: index ? "Jimmy Panetta" : "Peter Coe Verbica",
        })),
      },
    ],
  };
  assert.deepEqual(
    demandedRosterRaceKeys(canonical, ballotResearchDemand(provider, now), now),
    ["house-19"],
  );
  assert.deepEqual(
    demandedRosterRaceKeys(
      canonical,
      ballotResearchDemand(
        {
          ...provider,
          contests: [
            {
              ...(provider.contests[0] ?? contest),
              district: {
                id: race16.jurisdiction,
                name: "California Congressional District 16",
              },
            },
          ],
        },
        now,
      ),
      now,
    ),
    [],
  );
});
void test("warm observations retain original expiry and expired demand never widens scope", () => {
  const demand = ballotResearchDemand(ballot, now);
  const later = new Date(now.getTime() + 60_000);
  assert.deepEqual(ballotResearchDemand(ballot, later), demand);
  assert.deepEqual(
    demandedRosterRaceKeys(
      snapshot,
      demand,
      new Date(now.getTime() + 24 * 60 * 60 * 1000),
    ),
    [],
  );
  assert.deepEqual(demandedRosterRaceKeys(snapshot, [], now), []);
});
void test("operator requests identify districts without claiming an address-matched personal ballot", () => {
  const demands = [
    {
      kind: "operator_requested" as const,
      electionDate: snapshot.electionDate,
      contestId: "canonical-16",
      jurisdiction: race16.jurisdiction,
      raceKey: "house-16",
      reason: "User requested CA16 research",
      observedAt: now.toISOString(),
      expiresAt: "2026-11-04T00:00:00Z",
    },
  ];
  assert.deepEqual(demandedRosterRaceKeys(snapshot, demands, now), [
    "house-16",
  ]);
  assert.deepEqual(
    demandedRosterRaceKeys(
      snapshot,
      [
        {
          ...(demands[0] ?? assert.fail("missing operator demand")),
          contestId: "canonical-19",
        },
      ],
      now,
    ),
    [],
  );
});

void test(
  "real database demand is shared, private, monotonic, expiring and independent of publication",
  { skip: !process.env.BALLOT_DEMAND_TEST_DATABASE_URL },
  async () => {
    const value = process.env.BALLOT_DEMAND_TEST_DATABASE_URL;
    assert.ok(value);
    const target = new URL(value);
    assert.ok(["127.0.0.1", "localhost"].includes(target.hostname));
    assert.match(target.pathname, /_test$/);
    process.env.POSTGRES_URL = target.toString();
    const [{ db }, { CivicApiCache }, { eq }] = await Promise.all([
      import("@acme/db/client"),
      import("@acme/db/schema"),
      import("@acme/db"),
    ]);
    const rollback = new Error("rollback ballot demand fixture");
    await assert.rejects(
      db.transaction(async (tx) => {
        assert.deepEqual(
          await readDemandedRosterRaceKeys(tx, snapshot, now),
          [],
        );
        await recordBallotResearchDemand(tx, ballot, now);
        await recordBallotResearchDemand(
          tx,
          { ...ballot, submittedAddress: "DIFFERENT PRIVATE ADDRESS" },
          now,
        );
        assert.deepEqual(await readDemandedRosterRaceKeys(tx, snapshot, now), [
          "house-19",
        ]);
        const rows = await tx
          .select()
          .from(CivicApiCache)
          .where(eq(CivicApiCache.endpoint, BALLOT_RESEARCH_DEMAND_ENDPOINT));
        assert.equal(rows.length, 1);
        assert.equal(JSON.stringify(rows).includes("PRIVATE"), false);
        const expiry = rows[0]?.expiresAt;
        await recordBallotResearchDemand(
          tx,
          ballot,
          new Date(now.getTime() + 60_000),
        );
        const repeated = await tx
          .select()
          .from(CivicApiCache)
          .where(eq(CivicApiCache.endpoint, BALLOT_RESEARCH_DEMAND_ENDPOINT));
        assert.deepEqual(repeated[0]?.expiresAt, expiry);
        const older = {
          ...ballot,
          provider: {
            ...provider,
            fetchedAt: new Date(now.getTime() - 60_000).toISOString(),
          },
        };
        await recordBallotResearchDemand(tx, older, now);
        const retained = await tx
          .select()
          .from(CivicApiCache)
          .where(eq(CivicApiCache.endpoint, BALLOT_RESEARCH_DEMAND_ENDPOINT));
        assert.deepEqual(retained[0]?.expiresAt, expiry);
        assert.deepEqual(
          await readDemandedRosterRaceKeys(
            tx,
            snapshot,
            new Date(now.getTime() + 24 * 60 * 60 * 1000),
          ),
          [],
        );
        await requestOperatorResearch(
          tx,
          snapshot,
          ["house-16"],
          "User requested CA16 group research",
          now,
        );
        assert.deepEqual(await readDemandedRosterRaceKeys(tx, snapshot, now), [
          "house-16",
          "house-19",
        ]);
        assert.deepEqual(
          await readDemandedRosterRaceKeys(
            tx,
            snapshot,
            new Date("2026-11-04T08:00:00Z"),
          ),
          [],
        );
        await assert.rejects(
          () =>
            requestOperatorResearch(
              tx,
              snapshot,
              ["unknown"],
              "User requested unknown district",
              now,
            ),
          /authoritative race keys/,
        );
        throw rollback;
      }),
      (error: unknown) => error === rollback,
    );
  },
);
