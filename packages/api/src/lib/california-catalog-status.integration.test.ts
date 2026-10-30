import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import {
  californiaRosterSnapshotSchema,
  candidateBriefSchema,
  candidateRaceManifestSchema,
} from "@acme/validators";

import { californiaCandidateCatalog } from "./california-catalog";
import { readCaliforniaCatalogStatuses } from "./california-catalog-status";
import { briefDigest, briefIdentityKey } from "./candidate-brief-publication";

void test(
  "Postgres catalog fingerprints keep warm pages lightweight and invalidate changed dependencies",
  { skip: !process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL;
    assert.ok(url);
    const target = new URL(url);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(target.hostname) &&
        target.pathname.startsWith("/billion_candidate_") &&
        target.pathname.endsWith("_test"),
    );
    process.env.POSTGRES_URL = url;
    const { db } = await import("@acme/db/client");
    const { eq, inArray } = await import("@acme/db");
    const {
      CaliforniaRoster,
      CandidateBriefRevision,
      CandidateBriefReviewEvent,
      CandidateRaceRelease,
    } = await import("@acme/db/schema");
    const electionDate = "2099-11-03",
      namespace = randomUUID(),
      jurisdiction = `fixture:${namespace}`;
    const policy = { approved: true, version: `cache-${namespace}` };
    const fixtureNow = Date.now();
    const checked = new Date(fixtureNow - 7200000).toISOString();
    const reviewed = new Date(fixtureNow - 3600000);
    const expires = new Date(fixtureNow + 79200000).toISOString();
    const fixtures = Array.from({ length: 228 }, (_, index) => {
      const contestId = `${namespace}:race-${index}`;
      const briefs = Array.from({ length: index < 68 ? 1 : 2 }, (_, member) =>
        candidateBriefSchema.parse({
          schemaVersion: 1,
          identity: {
            candidateId: `${contestId}:${member}`,
            contestId,
            jurisdiction,
            electionDate,
          },
          revisionId: randomUUID(),
          supersedes: null,
          createdAt: checked,
          authorId: `author:${namespace}`,
          authorship: { kind: "human" },
          correction: null,
          evidence: [],
          sections: [
            "priorities",
            "record",
            "mechanisms",
            "effects",
            "tradeoffs",
            "unknowns",
          ].map((topic) => ({
            topic,
            claims: [],
            missingEvidence:
              "Synthetic test source gap. No promise is fabricated.",
          })),
        }),
      );
      const manifest = candidateRaceManifestSchema.parse({
        id: randomUUID(),
        contestId,
        jurisdiction,
        electionDate,
        jurisdictionLabel: "Fixture",
        office: "Fixture office",
        rosterSourceUrl: "https://example.org/roster",
        rosterHash: "a".repeat(64),
        rosterVerifiedAt: checked,
        rosterVerifiedBy: "fixture",
        members: briefs.map((brief) => ({
          candidateId: brief.identity.candidateId,
          revisionId: brief.revisionId,
          name: brief.identity.candidateId,
          description: null,
          ballotStatus: "on_ballot",
        })),
        policyVersion: policy.version,
        sourceCheckedAt: checked,
        expiresAt: expires,
        currentHashes: {},
      });
      return { manifest, briefs };
    });
    const snapshot = californiaRosterSnapshotSchema.parse({
      schemaVersion: 1,
      id: createHash("sha256").update(namespace).digest("hex"),
      electionDate,
      scope: "ca_sos_certified",
      scopeLabel: "Synthetic cache integration roster",
      source: {
        url: "https://example.org/roster",
        byteHash: "a".repeat(64),
        textHash: "b".repeat(64),
        fetchedAt: checked,
        encoding: "windows-1252",
        text: "Synthetic roster source",
      },
      certification: {
        url: "https://example.org/certified",
        textHash: "c".repeat(64),
        fetchedAt: checked,
        text: "Synthetic certified roster",
      },
      excludedContests: [],
      countyCoverage: [],
      races: fixtures.map(({ manifest, briefs }, index) => ({
        raceKey: manifest.contestId,
        contestId: manifest.contestId,
        jurisdiction,
        electionDate,
        jurisdictionLabel: "Fixture",
        sourceContestId: String(index),
        officeFamily: index < 64 ? "judicial_retention" : "state_assembly",
        office: manifest.office,
        district: String(index),
        kind: index < 64 ? "retention" : "election",
        rosterDigest: "d".repeat(64),
        members: briefs.map((brief, member) => ({
          identity: brief.identity,
          candidateId: brief.identity.candidateId,
          name: brief.identity.candidateId,
          sourceCandidateId: String(member),
          partyCode: "",
          party: null,
          ballotStatus: "on_ballot",
        })),
      })),
    });
    const successorId = createHash("sha256")
      .update(`${namespace}:successor`)
      .digest("hex");
    const revisionIds = fixtures.flatMap((value) =>
      value.briefs.map((brief) => brief.revisionId),
    );
    const releaseIds = fixtures.map((value) => value.manifest.id);
    let fullSelections = 0;
    const measured: Pick<typeof db, "transaction"> = {
      transaction: (run, config) =>
        db.transaction(
          (tx) =>
            run(
              new Proxy(tx, {
                get(target, property, receiver) {
                  if (property !== "select")
                    return Reflect.get(target, property, receiver) as unknown;
                  return (
                    fields: Parameters<typeof tx.select>[0] | undefined,
                  ) => {
                    if (fields === undefined) {
                      fullSelections++;
                      return tx.select();
                    }
                    return tx.select(fields);
                  };
                },
              }),
            ),
          config,
        ),
    };
    try {
      await db
        .insert(CaliforniaRoster)
        .values({ id: snapshot.id, electionDate, document: snapshot });
      await db.insert(CandidateBriefRevision).values(
        fixtures.flatMap((value) =>
          value.briefs.map((brief) => ({
            id: brief.revisionId,
            identityKey: briefIdentityKey(brief.identity),
            revisionDigest: briefDigest(brief),
            document: brief,
          })),
        ),
      );
      await db.insert(CandidateBriefReviewEvent).values(
        revisionIds.map((revisionId) => ({
          revisionId,
          actorId: `reviewer:${namespace}`,
          action: "approve",
          policyVersion: policy.version,
          reason: "Synthetic independent fixture review",
          createdAt: reviewed,
        })),
      );
      await db.insert(CandidateRaceRelease).values(
        fixtures.map((value) => ({
          id: value.manifest.id,
          document: value.manifest,
        })),
      );
      let cursor: string | undefined;
      const seen = new Set<string>();
      let pages = 0;
      let coldFullSelections = 0;
      do {
        fullSelections = 0;
        const { snapshot: current, races } =
          await readCaliforniaCatalogStatuses(measured, policy, electionDate);
        assert.equal(races.length, 228);
        const page = californiaCandidateCatalog(current, races, {
          electionDate,
          cursor,
          limit: 20,
        });
        assert.equal(page.coverage.publishedCandidates, 388);
        assert.equal(page.totalMatches, 388);
        for (const item of page.items) seen.add(item.identity.candidateId);
        if (pages === 0) {
          coldFullSelections = fullSelections;
          assert.equal(coldFullSelections, 4);
        } else
          assert.equal(
            fullSelections,
            0,
            "warm pages must not hydrate full roster, manifests, briefs or review attestations",
          );
        cursor = page.nextCursor ?? undefined;
        pages++;
      } while (cursor);
      assert.equal(seen.size, 388);
      assert.equal(pages, 20);
      t.diagnostic(
        JSON.stringify({
          postgresCatalogPages: pages,
          races: 228,
          candidates: 388,
          coldFullSelections,
          warmFullSelections: fullSelections,
        }),
      );
      const first = fixtures[0];
      assert.ok(first);
      const brief = first.briefs[0];
      assert.ok(brief);
      await db
        .update(CandidateBriefReviewEvent)
        .set({ attestation: { changed: true } })
        .where(eq(CandidateBriefReviewEvent.revisionId, brief.revisionId));
      fullSelections = 0;
      assert.equal(
        (await readCaliforniaCatalogStatuses(measured, policy, electionDate))
          .races.length,
        228,
      );
      assert.equal(
        fullSelections,
        3,
        "attestation mutation must force manifest, revision and event gate hydration",
      );
      await db
        .update(CandidateBriefReviewEvent)
        .set({ action: "reject" })
        .where(eq(CandidateBriefReviewEvent.revisionId, brief.revisionId));
      assert.equal(
        (await readCaliforniaCatalogStatuses(measured, policy, electionDate))
          .races.length,
        227,
      );
      const second = fixtures[1];
      assert.ok(second);
      await db
        .update(CandidateRaceRelease)
        .set({ revokedReason: "Synthetic source fetch failure" })
        .where(eq(CandidateRaceRelease.id, second.manifest.id));
      assert.equal(
        (await readCaliforniaCatalogStatuses(measured, policy, electionDate))
          .races.length,
        226,
      );
      const third = fixtures[2];
      assert.ok(third);
      const changedBrief = third.briefs[0];
      assert.ok(changedBrief);
      await db
        .update(CandidateBriefRevision)
        .set({
          document: { ...changedBrief, authorId: `reviewer:${namespace}` },
        })
        .where(eq(CandidateBriefRevision.id, changedBrief.revisionId));
      assert.equal(
        (await readCaliforniaCatalogStatuses(measured, policy, electionDate))
          .races.length,
        225,
      );
      const fourth = fixtures[3];
      assert.ok(fourth);
      const expired = {
        ...fourth.manifest,
        sourceCheckedAt: new Date(Date.now() - 86401000).toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };
      await db
        .update(CandidateRaceRelease)
        .set({ document: expired })
        .where(eq(CandidateRaceRelease.id, fourth.manifest.id));
      assert.equal(
        (await readCaliforniaCatalogStatuses(measured, policy, electionDate))
          .races.length,
        224,
      );
      assert.equal(
        (
          await readCaliforniaCatalogStatuses(
            measured,
            { ...policy, version: "wrong-version" },
            electionDate,
          )
        ).races.length,
        0,
      );
      assert.equal(
        (
          await readCaliforniaCatalogStatuses(
            measured,
            { ...policy, approved: false },
            electionDate,
          )
        ).races.length,
        0,
      );
      const changedSnapshot = {
        ...snapshot,
        id: createHash("sha256").update(`${namespace}:successor`).digest("hex"),
        races: snapshot.races.slice(0, 4),
      };
      await db.insert(CaliforniaRoster).values({
        id: changedSnapshot.id,
        electionDate,
        document: changedSnapshot,
        createdAt: new Date(Date.now() + 1000),
      });
      assert.equal(
        (await readCaliforniaCatalogStatuses(measured, policy, electionDate))
          .races.length,
        0,
      );
      await db
        .delete(CaliforniaRoster)
        .where(eq(CaliforniaRoster.id, changedSnapshot.id));
    } finally {
      await db
        .delete(CandidateRaceRelease)
        .where(inArray(CandidateRaceRelease.id, releaseIds));
      await db
        .delete(CandidateBriefReviewEvent)
        .where(inArray(CandidateBriefReviewEvent.revisionId, revisionIds));
      await db
        .delete(CandidateBriefRevision)
        .where(inArray(CandidateBriefRevision.id, revisionIds));
      await db
        .delete(CaliforniaRoster)
        .where(inArray(CaliforniaRoster.id, [snapshot.id, successorId]));
    }
  },
);
