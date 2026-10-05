import assert from "node:assert/strict";
import test from "node:test";

import { candidateBriefSchema } from "@acme/validators";

import type { PublicationContext } from "./candidate-brief-publication";
import {
  briefDigest,
  briefIdentityKey,
  evidenceHashKey,
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
    roster: {
      verified: true,
      candidateIds: ["incumbent", "challenger"],
      contestId: "fixture-race",
      electionDate: "2026-11-03",
      jurisdiction: "fixture:ca",
    },
    reviews: briefs.map((b) => ({
      candidateId: b.identity.candidateId,
      revisionDigest: briefDigest(b),
      reviewerId: "editor",
      reviewedAt: "2026-10-02T00:00:00Z",
      policyVersion: "proposal-v1",
    })),
    currentHashes: {
      [evidenceHashKey(required(briefs[0]).identity, "record")]: "a".repeat(64),
    },
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
  c.currentHashes[evidenceHashKey(required(briefs[0]).identity, "record")] =
    "b".repeat(64);
  assert.equal(publishableRace(briefs, c).status, "stale");
  c.currentHashes[evidenceHashKey(required(briefs[0]).identity, "record")] =
    "a".repeat(64);
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

void test("verified roster must belong to the same race, election and jurisdiction", () => {
  for (const field of ["contestId", "electionDate", "jurisdiction"] as const) {
    const c = context();
    c.roster[field] = "unrelated";
    assert.equal(publishableRace(briefs, c).status, "incomplete_race");
  }
});

void test("empty and whitespace-padded self-review cannot approve", () => {
  for (const reviewerId of ["", "   ", " writer "]) {
    const c = context();
    required(c.reviews[0]).reviewerId = reviewerId;
    assert.equal(publishableRace(briefs, c).status, "review_pending");
  }
});

void test("same local evidence ID across candidates retains separate current hashes", () => {
  const race = structuredClone(briefs);
  const second = required(race[1]);
  second.evidence = [
    { ...required(required(race[0]).evidence[0]), contentHash: "b".repeat(64) },
  ];
  const c = context();
  c.currentHashes[evidenceHashKey(second.identity, "record")] = "b".repeat(64);
  required(c.reviews[1]).revisionDigest = briefDigest(second);
  assert.equal(publishableRace(race, c).status, "published");
});

void test("race snapshot validates expiry, source changes, withdrawal and member mapping", async () => {
  const { readCandidateRace } = await import("./candidate-race-release");
  const c = context();
  const manifest = {
    id: "00000000-0000-4000-8000-000000000443",
    ...required(briefs[0]).identity,
    jurisdictionLabel: "Fixture city",
    office: "Mayor",
    rosterSourceUrl: "https://example.org/official-roster",
    rosterHash: "b".repeat(64),
    rosterVerifiedAt: "2026-10-02T00:00:00Z",
    rosterVerifiedBy: "editor",
    members: briefs.map((b) => ({
      candidateId: b.identity.candidateId,
      revisionId: b.revisionId,
      name: b.identity.candidateId,
      description: null,
      ballotStatus: "on_ballot",
    })),
    policyVersion: c.policy.version,
    sourceCheckedAt: "2026-10-02T00:00:00Z",
    expiresAt: "2026-10-03T00:00:00Z",
    currentHashes: c.currentHashes,
  };
  const input = {
    manifest,
    revokedReason: null as string | null,
    revisions: briefs.map((b) => ({
      id: b.revisionId,
      document: b,
      revisionDigest: briefDigest(b),
    })),
    events: briefs.map((b) => ({
      revisionId: b.revisionId,
      actorId: "editor",
      action: "approve",
      policyVersion: c.policy.version,
      createdAt: new Date("2026-10-02T00:00:00Z"),
    })),
    now: c.now,
    policy: c.policy,
  };
  assert.equal(readCandidateRace(input)?.briefs.length, 2);
  assert.equal(readCandidateRace({ ...input, now: manifest.expiresAt }), null);
  assert.equal(
    readCandidateRace({ ...input, revokedReason: "Source changed" }),
    null,
  );
  assert.equal(readCandidateRace({ ...input, events: [] }), null);
  assert.equal(
    readCandidateRace({
      ...input,
      policy: { approved: false, version: c.policy.version },
    }),
    null,
  );
  assert.equal(
    readCandidateRace({ ...input, revisions: input.revisions.slice(1) }),
    null,
  );
  const swapped = structuredClone(manifest);
  required(swapped.members[0]).revisionId = required(
    manifest.members[1],
  ).revisionId;
  required(swapped.members[1]).revisionId = required(
    manifest.members[0],
  ).revisionId;
  assert.equal(readCandidateRace({ ...input, manifest: swapped }), null);
  assert.equal(
    readCandidateRace({
      ...input,
      manifest: { ...manifest, currentHashes: {} },
    }),
    null,
  );
  assert.equal(
    readCandidateRace({
      ...input,
      events: [
        ...input.events,
        { ...required(input.events[0]), action: "withdraw" },
      ],
    }),
    null,
  );
});

void test(
  "stored revisions → tRPC race; withdrawal and a revoked successor suppress the full race",
  { skip: !process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL },
  async () => {
    const url = process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL;
    assert.ok(url);
    const target = new URL(url);
    assert.ok(
      ["127.0.0.1", "localhost"].includes(target.hostname) &&
        target.pathname.startsWith("/billion_candidate_"),
      "Use an explicitly disposable local candidate test database",
    );
    process.env.POSTGRES_URL = url;
    const { db } = await import("@acme/db/client");
    const { eq, inArray } = await import("@acme/db");
    const {
      CandidateBriefRevision,
      CandidateBriefReviewEvent,
      CandidateRaceRelease,
    } = await import("@acme/db/schema");
    const { createCandidateBriefsRouter } =
      await import("../router/candidate-briefs");
    const { createTRPCRouter } = await import("../trpc");
    const { randomUUID } = await import("node:crypto");
    const releaseId = randomUUID();
    const successorId = randomUUID();
    const eventIds: string[] = [];
    const copies = briefs.map((brief) => ({
      ...structuredClone(brief),
      revisionId: randomUUID(),
    }));
    const now = new Date();
    const manifest = {
      id: releaseId,
      ...required(copies[0]).identity,
      office: "Mayor",
      jurisdictionLabel: "Disposable fixture city",
      rosterSourceUrl: "https://example.org/roster",
      rosterHash: "b".repeat(64),
      rosterVerifiedAt: now.toISOString(),
      rosterVerifiedBy: "test-editor",
      members: copies.map((b) => ({
        candidateId: b.identity.candidateId,
        revisionId: b.revisionId,
        name: b.identity.candidateId,
        description: null,
        ballotStatus: "on_ballot" as const,
      })),
      policyVersion: "test-only",
      sourceCheckedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 3_600_000).toISOString(),
      currentHashes: context().currentHashes,
    };
    const caller = createTRPCRouter(
      createCandidateBriefsRouter({ approved: true, version: "test-only" }),
    ).createCaller({ db, session: null, authApi: {} } as never);
    try {
      await db.insert(CandidateBriefRevision).values(
        copies.map((b) => ({
          id: b.revisionId,
          identityKey: briefIdentityKey(b.identity),
          revisionDigest: briefDigest(b),
          document: b,
        })),
      );
      for (const b of copies) {
        const id = randomUUID();
        eventIds.push(id);
        await db.insert(CandidateBriefReviewEvent).values({
          id,
          revisionId: b.revisionId,
          actorId: "independent-test-editor",
          action: "approve",
          policyVersion: "test-only",
          reason: "Disposable fixture review",
        });
      }
      await db
        .insert(CandidateRaceRelease)
        .values({ id: releaseId, document: manifest });
      assert.equal((await caller.race({ releaseId }))?.briefs.length, 2);
      assert.equal(
        (await caller.get(required(copies[0]).identity)).status,
        "published",
      );
      assert.ok((await caller.listRaces()).some((r) => r.id === releaseId));
      await db.insert(CandidateRaceRelease).values({
        id: successorId,
        document: { ...manifest, id: successorId },
        revokedReason: "Source correction",
      });
      assert.equal(
        await caller.race({ releaseId }),
        null,
        "Older release must not reappear after successor revocation",
      );
      assert.equal(await caller.race({ releaseId: successorId }), null);
      assert.equal(
        (await caller.get(required(copies[0]).identity)).brief,
        null,
      );
      await db
        .delete(CandidateRaceRelease)
        .where(eq(CandidateRaceRelease.id, successorId));
      const withdrawalId = randomUUID();
      eventIds.push(withdrawalId);
      await db.insert(CandidateBriefReviewEvent).values({
        id: withdrawalId,
        revisionId: required(copies[1]).revisionId,
        actorId: "independent-test-editor",
        action: "withdraw",
        policyVersion: "test-only",
        reason: "Changed source fixture",
      });
      assert.equal(await caller.race({ releaseId }), null);
      assert.equal(
        (await caller.get(required(copies[0]).identity)).brief,
        null,
      );
    } finally {
      await db
        .delete(CandidateRaceRelease)
        .where(inArray(CandidateRaceRelease.id, [releaseId, successorId]));
      if (eventIds.length)
        await db
          .delete(CandidateBriefReviewEvent)
          .where(inArray(CandidateBriefReviewEvent.id, eventIds));
      await db.delete(CandidateBriefRevision).where(
        inArray(
          CandidateBriefRevision.id,
          copies.map((b) => b.revisionId),
        ),
      );
    }
  },
);
