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
      CaliforniaRaceWork,
      CandidateBriefRevision,
      CandidateBriefReviewEvent,
      CandidateRaceRelease,
    } = await import("@acme/db/schema");
    const { saveCaliforniaRoster } = await import("./california-roster-store");
    const { getPublicCaliforniaRoster, getPublicCaliforniaRosterMetadata } =
      await import("./california-public-roster");
    const privateArchive = "PRIVATE_ROSTER_ARCHIVE_SENTINEL".repeat(150000);
    const electionDate = "2099-11-03",
      namespace = randomUUID(),
      jurisdiction = `fixture:${namespace}`;
    const policy = { approved: true, version: `cache-${namespace}` };
    const snapshotId = createHash("sha256").update(namespace).digest("hex");
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
        rosterSnapshotId: snapshotId,
        rosterDigest: "d".repeat(64),
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
      id: snapshotId,
      electionDate,
      scope: "ca_sos_certified",
      scopeLabel: "Synthetic cache integration roster",
      source: {
        url: "https://example.org/roster",
        byteHash: "a".repeat(64),
        textHash: "b".repeat(64),
        fetchedAt: checked,
        encoding: "windows-1252",
        text: privateArchive,
      },
      certification: {
        url: "https://example.org/certified",
        textHash: "c".repeat(64),
        fetchedAt: checked,
        text: privateArchive,
      },
      additionalSources: [
        {
          id: "private-current-proof",
          url: "https://example.org/private-current-proof",
          publisher: "Synthetic private archive",
          format: "text",
          text: privateArchive,
          contentHash: "a".repeat(64),
          fetchedAt: checked,
        },
      ],
      historicalSources: [
        {
          id: "private-reviewed-proof",
          url: "https://example.org/private-reviewed-proof",
          publisher: "Synthetic private archive",
          format: "text",
          text: privateArchive,
          contentHash: "a".repeat(64),
          fetchedAt: checked,
        },
      ],
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
    let privateRosterSelections = 0;
    function trace<T extends Pick<typeof db, "select">>(database: T): T {
      return new Proxy(database, {
        get(target, property, receiver) {
          if (property !== "select")
            return Reflect.get(target, property, receiver) as unknown;
          return (
            fields: Parameters<typeof database.select>[0] | undefined,
          ) => {
            if (fields !== undefined) {
              if (
                Object.values(fields).some(
                  (value) => value === CaliforniaRoster.document,
                )
              )
                privateRosterSelections++;
              return database.select(fields);
            }
            fullSelections++;
            const builder = database.select();
            return new Proxy(builder, {
              get(target, property, receiver) {
                if (property !== "from")
                  return Reflect.get(target, property, receiver) as unknown;
                return (...args: unknown[]) => {
                  if (args[0] === CaliforniaRoster) privateRosterSelections++;
                  return Reflect.apply(
                    builder.from.bind(builder),
                    undefined,
                    args,
                  ) as unknown;
                };
              },
            });
          };
        },
      });
    }
    const measured: Pick<typeof db, "transaction"> = {
      transaction: (run, config) =>
        db.transaction((tx) => run(trace(tx)), config),
    };
    const measuredReader = new Proxy(trace(db), {
      get(target, property, receiver) {
        if (property === "transaction") return measured.transaction;
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    try {
      await saveCaliforniaRoster(db, snapshot);
      const publicRoster = await getPublicCaliforniaRoster(
        measuredReader,
        snapshot.id,
      );
      const publicBytes = Buffer.byteLength(JSON.stringify(publicRoster));
      assert.ok(publicBytes < 1000000);
      assert.equal(
        JSON.stringify(publicRoster).includes(
          "PRIVATE_ROSTER_ARCHIVE_SENTINEL",
        ),
        false,
      );
      const before = await getPublicCaliforniaRosterMetadata(
        measuredReader,
        snapshot.id,
      );
      const changedPrivate = {
        ...snapshot,
        source: {
          ...snapshot.source,
          text: `${privateArchive} changed private archive`,
        },
      };
      await db
        .update(CaliforniaRoster)
        .set({ document: changedPrivate })
        .where(eq(CaliforniaRoster.id, snapshot.id));
      const after = await getPublicCaliforniaRosterMetadata(
        measuredReader,
        snapshot.id,
      );
      assert.equal(
        after?.fingerprint,
        before?.fingerprint,
        "private archive changes must not enter the metadata fingerprint",
      );
      assert.equal(privateRosterSelections, 0);
      t.diagnostic(
        JSON.stringify({
          privateArchiveBytes: Buffer.byteLength(
            JSON.stringify(changedPrivate),
          ),
          publicRosterProjectionBytes: publicBytes,
        }),
      );
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
          assert.equal(coldFullSelections, 3);
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
      const { createTRPCRouter } = await import("../trpc");
      const { createCandidateBriefsRouter } =
        await import("../router/candidate-briefs");
      const reader = createTRPCRouter(
        createCandidateBriefsRouter(policy),
      ).createCaller({
        db: measuredReader,
        session: null,
        authApi: {},
      } as never);
      const last = fixtures.at(-1);
      assert.ok(last);
      const lastBrief = last.briefs[0];
      assert.ok(lastBrief);
      assert.equal(
        (await reader.forCandidate({ identity: lastBrief.identity })).status,
        "published",
      );
      await db
        .delete(CaliforniaRaceWork)
        .where(eq(CaliforniaRaceWork.key, `source-epoch:${electionDate}`));
      await db
        .delete(CaliforniaRoster)
        .where(eq(CaliforniaRoster.id, snapshot.id));
      const missing = await readCaliforniaCatalogStatuses(
        measured,
        policy,
        electionDate,
      );
      assert.equal(missing.snapshot, null);
      assert.deepEqual(
        missing.races,
        [],
        "warm cached statuses require a currently available authoritative roster",
      );
      assert.equal(
        (await reader.forCandidate({ identity: lastBrief.identity })).status,
        "unavailable",
      );
      const missingCatalog = await reader.catalog({ electionDate, limit: 20 });
      assert.equal(missingCatalog.coverage.publishedCandidates, 0);
      assert.deepEqual(missingCatalog.items, []);
      const missingBrief = await reader.get(lastBrief.identity);
      assert.equal(missingBrief.status, "unavailable");
      assert.equal(missingBrief.brief, null);
      assert.equal(await reader.race({ releaseId: last.manifest.id }), null);
      await saveCaliforniaRoster(db, snapshot);
      assert.equal(
        (await readCaliforniaCatalogStatuses(measured, policy, electionDate))
          .races.length,
        228,
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
      await saveCaliforniaRoster(db, changedSnapshot);
      assert.equal(
        (await readCaliforniaCatalogStatuses(measured, policy, electionDate))
          .races.length,
        0,
      );
      await saveCaliforniaRoster(db, snapshot);
      const restored = await readCaliforniaCatalogStatuses(
        measured,
        policy,
        electionDate,
      );
      assert.equal(restored.snapshot?.id, snapshot.id);
      assert.equal(
        restored.races.length,
        0,
        "historical A must become current without resurrecting releases revoked by the intervening cutover",
      );
      const persisted = await db
        .select({ id: CaliforniaRoster.id })
        .from(CaliforniaRoster)
        .where(inArray(CaliforniaRoster.id, [snapshot.id, changedSnapshot.id]));
      assert.equal(persisted.length, 2);
      assert.equal(
        privateRosterSelections,
        0,
        "no public cold, warm or direct reader may select the private roster document",
      );
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
        .delete(CaliforniaRaceWork)
        .where(eq(CaliforniaRaceWork.key, `source-epoch:${electionDate}`));
      await db
        .delete(CaliforniaRoster)
        .where(inArray(CaliforniaRoster.id, [snapshot.id, successorId]));
    }
  },
);
