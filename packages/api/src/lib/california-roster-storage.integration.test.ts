import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { eq, inArray, sql } from "@acme/db";
import {
  CaliforniaRaceWork,
  CaliforniaResearchArtifact,
  CaliforniaRoster,
} from "@acme/db/schema";
import { californiaRosterSnapshotSchema } from "@acme/validators";

import { californiaCandidateCatalog } from "./california-catalog";
import { readCaliforniaCatalogStatuses } from "./california-catalog-status";
import {
  getPublicCaliforniaRoster,
  getPublicCaliforniaRosterMetadata,
} from "./california-public-roster";
import { encodeCaliforniaRosterStorage } from "./california-roster-storage";
import {
  getCaliforniaRoster,
  getCurrentCaliforniaRosterId,
  saveCaliforniaRoster,
} from "./california-roster-store";

const url = process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL;
const fixture = process.env.CALIFORNIA_STORAGE_FIXTURE_PATH;
if (url && fixture) {
  const target = new URL(url);
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55464" ||
    target.pathname !== "/roster_storage_test"
  )
    throw new Error(
      "Roster storage proof requires the isolated localhost55464 database",
    );
  process.env.POSTGRES_URL = url;
}
void test(
  "sealed full roster keeps exact domain and SQL projections with bounded transactional storage",
  { skip: !url || !fixture },
  async (t) => {
    const { db } = await import("@acme/db/client");
    assert.ok(fixture);
    const original = await readFile(fixture, "utf8");
    const hash = (text: string) =>
      createHash("sha256").update(text).digest("hex");
    const digest = hash(original);
    const snapshot = californiaRosterSnapshotSchema.parse(JSON.parse(original));
    const projectionComparator = {
      ...snapshot,
      additionalSources: [],
      localPrimary: snapshot.localPrimary && {
        ...snapshot.localPrimary,
        reviewedSources: [],
      },
    };
    const legacyId = `storage-test-${randomUUID()}`;
    const failedId = hash(randomUUID());
    const encoded = encodeCaliforniaRosterStorage(snapshot);
    const keys = [...encoded.archives.keys()];
    const source = (text: string) => ({
      id: text,
      url: "https://example.gov/storage-test",
      publisher: "Test fixture",
      format: "text" as const,
      text,
      contentHash: hash(text),
      fetchedAt: snapshot.source.fetchedAt,
    });
    const rollbackInput = {
      ...snapshot,
      id: failedId,
      localPrimary: undefined,
      additionalSources: [source(randomUUID()), source(randomUUID())],
    };
    const rollbackArchives = [
      ...encodeCaliforniaRosterStorage(rollbackInput).archives,
    ];
    const poison = rollbackArchives[1];
    const firstArchive = rollbackArchives[0];
    assert.ok(poison && firstArchive);
    const poisonedKey = poison[0];
    const allKeys = [...keys, ...rollbackArchives.map(([key]) => key)];
    const [prior] = await db
      .select({ id: CaliforniaRoster.id })
      .from(CaliforniaRoster)
      .where(eq(CaliforniaRoster.id, snapshot.id));
    assert.equal(prior, undefined);
    assert.equal(
      await getCurrentCaliforniaRosterId(db, snapshot.electionDate),
      null,
    );
    assert.equal(
      (
        await db
          .select({ key: CaliforniaResearchArtifact.key })
          .from(CaliforniaResearchArtifact)
          .where(inArray(CaliforniaResearchArtifact.key, allKeys))
      ).length,
      0,
    );
    const contactProjection = async (id: string) => {
      const [row] = await db
        .select({
          kind: sql<unknown>`${CaliforniaRoster.document}->'localPrimary'->'kind'`,
          aliases: sql<unknown>`${CaliforniaRoster.document}->'localPrimary'->'identityCrosswalk'`,
          memberships: sql<unknown>`${CaliforniaRoster.document}->'races'`,
          scope: sql<unknown>`${CaliforniaRoster.document}->'localCrosswalk'`,
          archives: sql<unknown>`${CaliforniaRoster.document}->'historicalSources'`,
        })
        .from(CaliforniaRoster)
        .where(eq(CaliforniaRoster.id, id));
      return row;
    };
    try {
      await db.insert(CaliforniaRoster).values({
        id: legacyId,
        electionDate: snapshot.electionDate,
        document: projectionComparator,
      });
      const publicBefore = await getPublicCaliforniaRoster(db, legacyId);
      const metadataBefore = await getPublicCaliforniaRosterMetadata(
        db,
        legacyId,
      );
      const contactsBefore = await contactProjection(legacyId);
      assert.deepEqual(
        await getCaliforniaRoster(db, legacyId),
        projectionComparator,
      );
      await db
        .delete(CaliforniaRoster)
        .where(eq(CaliforniaRoster.id, legacyId));
      assert.deepEqual(await saveCaliforniaRoster(db, snapshot), snapshot);
      const [stored] = await db
        .select({
          bytes: sql<number>`octet_length(${CaliforniaRoster.document}::text)`,
        })
        .from(CaliforniaRoster)
        .where(eq(CaliforniaRoster.id, snapshot.id));
      assert.ok(
        stored && stored.bytes < 4 * 1024 * 1024,
        `Manifest is ${stored?.bytes} bytes`,
      );
      assert.deepEqual(await getCaliforniaRoster(db, snapshot.id), snapshot);
      assert.deepEqual(
        await getPublicCaliforniaRoster(db, snapshot.id),
        publicBefore,
      );
      assert.equal(
        (await getPublicCaliforniaRosterMetadata(db, snapshot.id))?.fingerprint,
        metadataBefore?.fingerprint,
      );
      assert.deepEqual(await contactProjection(snapshot.id), contactsBefore);
      const catalogIdentities: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const status = await readCaliforniaCatalogStatuses(
          db,
          { approved: false, version: "storage-proof-unattested" },
          snapshot.electionDate,
        );
        const page = californiaCandidateCatalog(status.snapshot, status.races, {
          electionDate: snapshot.electionDate,
          limit: 20,
          cursor,
        });
        catalogIdentities.push(
          ...page.items.map(({ identity }) => JSON.stringify(identity)),
        );
        cursor = page.nextCursor ?? undefined;
        pages++;
        assert.ok(pages <= 100, "Catalog pagination must terminate");
      } while (cursor);
      const expectedIdentities = snapshot.races.flatMap(({ members }) =>
        members.map(({ identity }) => JSON.stringify(identity)),
      );
      assert.deepEqual(catalogIdentities.sort(), expectedIdentities.sort());

      assert.deepEqual(
        await saveCaliforniaRoster(db, {
          ...snapshot,
          scopeLabel: "ignored later same-ID input",
          additionalSources: [],
        }),
        snapshot,
      );
      const [archives] = await db
        .select({
          count: sql<number>`count(*)::int`,
          largest: sql<number>`max(octet_length(${CaliforniaResearchArtifact.document}::text))`,
        })
        .from(CaliforniaResearchArtifact)
        .where(inArray(CaliforniaResearchArtifact.key, keys));
      assert.ok(archives);
      assert.equal(archives.count, 30);
      assert.ok(archives.largest < 6 * 1024 * 1024);
      await db.insert(CaliforniaResearchArtifact).values({
        key: poisonedKey,
        kind: "wrong_kind",
        raceKey: "__storage_test__",
        document: poison[1],
      });
      await assert.rejects(
        saveCaliforniaRoster(db, rollbackInput),
        /archive kind/,
      );
      assert.equal(
        await getCurrentCaliforniaRosterId(db, snapshot.electionDate),
        snapshot.id,
      );
      assert.equal(
        (
          await db
            .select({ id: CaliforniaRoster.id })
            .from(CaliforniaRoster)
            .where(eq(CaliforniaRoster.id, failedId))
        ).length,
        0,
      );
      assert.equal(
        (
          await db
            .select({ key: CaliforniaResearchArtifact.key })
            .from(CaliforniaResearchArtifact)
            .where(eq(CaliforniaResearchArtifact.key, firstArchive[0]))
        ).length,
        0,
      );
      const key = keys[0];
      assert.ok(key);
      const [savedBody] = await db
        .select()
        .from(CaliforniaResearchArtifact)
        .where(eq(CaliforniaResearchArtifact.key, key));
      assert.ok(savedBody);
      await db
        .delete(CaliforniaResearchArtifact)
        .where(eq(CaliforniaResearchArtifact.key, key));
      await assert.rejects(
        getCaliforniaRoster(db, snapshot.id),
        /Missing roster source archive/,
      );
      await db.insert(CaliforniaResearchArtifact).values({
        ...savedBody,
        document: { ...encoded.archives.get(key), text: "corrupted" },
      });
      await assert.rejects(
        getCaliforniaRoster(db, snapshot.id),
        /identity mismatch/,
      );
      await db
        .update(CaliforniaResearchArtifact)
        .set({ document: savedBody.document })
        .where(eq(CaliforniaResearchArtifact.key, key));
      assert.deepEqual(await getCaliforniaRoster(db, snapshot.id), snapshot);
      assert.equal(hash(await readFile(fixture, "utf8")), digest);
      t.diagnostic(
        JSON.stringify({
          snapshotId: snapshot.id,
          sourceFileSha256: digest,
          originalDomainBytes: Buffer.byteLength(JSON.stringify(snapshot)),
          storedManifestBytes: stored.bytes,
          archiveCount: archives.count,
          largestArchiveBytes: archives.largest,
          exactDomain: true,
          identicalPublicFingerprint: true,
          identicalContactPaths: true,
          catalogPages: pages,
          catalogCandidates: catalogIdentities.length,
        }),
      );
    } finally {
      await db
        .delete(CaliforniaRaceWork)
        .where(inArray(CaliforniaRaceWork.snapshotId, [snapshot.id, failedId]));
      await db
        .delete(CaliforniaRoster)
        .where(inArray(CaliforniaRoster.id, [snapshot.id, legacyId, failedId]));
      await db
        .delete(CaliforniaResearchArtifact)
        .where(inArray(CaliforniaResearchArtifact.key, allKeys));
    }
  },
);
