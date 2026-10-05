import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

function required<T>(value: T | undefined): T {
  assert.ok(value);
  return value;
}
void test(
  "collected research → authenticated review → publication → safe refresh",
  { skip: !process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL },
  async (t) => {
    const url = required(process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL);
    const target = new URL(url);
    assert.ok(
      ["127.0.0.1", "localhost"].includes(target.hostname) &&
        target.pathname.startsWith("/billion_candidate_"),
    );
    process.env.POSTGRES_URL = url;
    const { db } = await import("@acme/db/client");
    const { eq, inArray, sql } = await import("@acme/db");
    const {
      CandidateResearchCollection: Collection,
      CandidateResearchEditor: Editor,
      CandidateResearchPolicy: Policy,
      CandidateRaceRelease: Release,
      CandidateBriefRevision: Revision,
      CandidateBriefReviewEvent: Review,
    } = await import("@acme/db/schema");
    const { candidateResearchCollectionSchema } =
      await import("@acme/validators");
    const {
      saveResearchCollection,
      failResearchRefresh,
      activeResearchPolicy,
      lockPilot,
    } = await import("./candidate-research-store");
    const { evidenceHashKey } = await import("./candidate-brief-publication");
    const { createTRPCRouter } = await import("../trpc");
    const { candidateResearchEditorialRouter } =
      await import("../router/candidate-research-editorial");
    const { createCandidateBriefsRouter } =
      await import("../router/candidate-briefs");
    const pilotKey = `test-${randomUUID()}`,
      editorId = randomUUID(),
      publisherId = randomUUID(),
      version = randomUUID();
    const router = createTRPCRouter(candidateResearchEditorialRouter);
    const caller = (id: string | null) =>
      router.createCaller({
        db,
        session: id ? { user: { id } } : null,
        authApi: {},
      } as never);
    const editor = caller(editorId),
      publisher = caller(publisherId);
    const reader = createTRPCRouter(
      createCandidateBriefsRouter(activeResearchPolicy),
    ).createCaller({ db, session: null, authApi: {} } as never);
    function fixture(text = "Synthetic source passage") {
      const now = new Date().toISOString(),
        contentHash = createHash("sha256").update(text).digest("hex");
      const identity = {
        candidateId: pilotKey,
        contestId: pilotKey,
        jurisdiction: `fixture:${pilotKey}`,
        electionDate: "2026-11-03",
      };
      const revisionId = randomUUID();
      return candidateResearchCollectionSchema.parse({
        pilotKey,
        problems: [],
        sources: [
          {
            id: "source",
            url: "https://example.org/test-source",
            publisher: "Synthetic fixture",
            format: "text",
            text,
            contentHash,
            fetchedAt: now,
          },
        ],
        briefs: [
          {
            schemaVersion: 1,
            identity,
            revisionId,
            supersedes: null,
            createdAt: now,
            authorId: "pipeline-fixture",
            authorship: { kind: "human" },
            correction: null,
            evidence: [
              {
                id: "source",
                url: "https://example.org/test-source",
                publisher: "Synthetic fixture",
                locator: "Test passage",
                retrievedAt: now,
                documentDate: null,
                contentHash,
                excerpt: text,
                origin: "primary_record",
              },
            ],
            sections: [
              "priorities",
              "record",
              "mechanisms",
              "effects",
              "tradeoffs",
              "unknowns",
            ].map((topic) => ({
              topic,
              missingEvidence: "Synthetic fixture; no real research.",
              claims:
                topic === "record"
                  ? [
                      {
                        id: "record",
                        kind: "fact",
                        text: "Synthetic claim",
                        evidenceIds: ["source"],
                      },
                    ]
                  : [],
            })),
          },
        ],
        manifest: {
          id: randomUUID(),
          ...identity,
          office: "Test office",
          jurisdictionLabel: "Synthetic test",
          rosterSourceUrl: "https://example.org/test-source",
          rosterHash: contentHash,
          rosterVerifiedAt: now,
          rosterVerifiedBy: "test",
          members: [
            {
              candidateId: pilotKey,
              revisionId,
              name: "Synthetic candidate",
              description: null,
              ballotStatus: "on_ballot",
            },
          ],
          policyVersion: "pending",
          sourceCheckedAt: now,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          currentHashes: { [evidenceHashKey(identity, "source")]: contentHash },
        },
      });
    }
    const document = fixture();
    const revisionId = required(document.briefs[0]).revisionId;
    let collectionId = "",
      releaseId = "";
    try {
      await db.insert(Editor).values([
        { userId: editorId, canPublish: false, grantedBy: "test" },
        { userId: publisherId, canPublish: true, grantedBy: "test" },
      ]);
      await t.test(
        "unauthenticated and unprovisioned users cannot inspect drafts",
        async () => {
          await assert.rejects(() => caller(null).list(), /UNAUTHORIZED/);
          await assert.rejects(
            () => caller(randomUUID()).list(),
            /editor access required/,
          );
        },
      );
      await t.test(
        "bad hashes and forged citation URLs are rejected",
        async () => {
          const bad = structuredClone(document);
          required(bad.sources[0]).text = "Tampered source";
          await assert.rejects(() => saveResearchCollection(bad, db));
          const forged = structuredClone(document);
          required(required(forged.briefs[0]).evidence[0]).url =
            "https://example.org/forged";
          await assert.rejects(() => saveResearchCollection(forged, db));
        },
      );
      collectionId = (await saveResearchCollection(document, db)).collectionId;
      await t.test(
        "policy approval and publication are publisher-only; draft preview is protected",
        async () => {
          assert.equal(
            (await editor.preview({ id: collectionId })).briefs.length,
            1,
          );
          await assert.rejects(
            () =>
              editor.approvePolicy({
                version,
                statement:
                  "Synthetic test policy only. This does not approve any real race or source in the local database.",
              }),
            /FORBIDDEN/,
          );
          await assert.rejects(
            () => editor.publish({ collectionId }),
            /FORBIDDEN/,
          );
          await publisher.approvePolicy({
            version,
            statement:
              "Synthetic test policy only. This does not approve any real race or source in the local database.",
          });
          await assert.rejects(
            () => publisher.publish({ collectionId }),
            /independent approval/,
          );
        },
      );
      await t.test(
        "exact revision approval publishes the complete synthetic race",
        async () => {
          await editor.review({
            collectionId,
            revisionId,
            action: "approve",
            policyVersion: version,
            reason: "Independent synthetic test review",
          });
          releaseId = (await publisher.publish({ collectionId })).releaseId;
          assert.equal(
            (await reader.race({ releaseId }))?.briefs[0]?.revisionId,
            revisionId,
          );
        },
      );
      await t.test(
        "unchanged source refresh preserves the release URL and approved revision",
        async () => {
          const result = await saveResearchCollection(fixture(), db);
          assert.equal(result.changed, false);
          const race = await reader.race({ releaseId });
          assert.equal(race?.manifest.id, releaseId);
          assert.equal(race.briefs[0]?.revisionId, revisionId);
        },
      );
      await t.test(
        "review rechecks failure after waiting for a concurrent refresh lock",
        async () => {
          let unlock!: () => void;
          const gate = new Promise<void>((resolve) => {
            unlock = resolve;
          });
          let locked!: () => void;
          const acquired = new Promise<void>((resolve) => {
            locked = resolve;
          });
          const holding = db.transaction(async (tx) => {
            await lockPilot(tx, pilotKey);
            locked();
            await gate;
            await tx
              .update(Collection)
              .set({ failure: "Concurrent fetch failed" })
              .where(eq(Collection.id, collectionId));
          });
          await acquired;
          const reviewing = editor.review({
            collectionId,
            revisionId,
            action: "approve",
            policyVersion: version,
            reason: "Must reject after concurrent failure",
          });
          // Wait for the API transaction to reach the held advisory lock, not an arbitrary sleep.
          let waiting = false;
          try {
            for (let i = 0; i < 100; i++) {
              const rows = await db.execute(
                sql`select exists(select 1 from pg_locks where locktype='advisory' and not granted) as waiting`,
              );
              if (rows.rows[0]?.waiting) {
                waiting = true;
                break;
              }
              await new Promise((r) => setTimeout(r, 10));
            }
          } finally {
            unlock();
          }
          await holding;
          assert.ok(waiting, "review reached lock barrier");
          await assert.rejects(() => reviewing, /Refresh all sources/);
        },
      );
      await t.test(
        "failed refresh withdraws the whole race and recovery requires new review",
        async () => {
          await failResearchRefresh(pilotKey, "Test source failed", db);
          assert.equal(await reader.race({ releaseId }), null);
          const recovered = await saveResearchCollection(fixture(), db);
          assert.equal(recovered.changed, true);
          await assert.rejects(
            () => publisher.publish({ collectionId: recovered.collectionId }),
            /independent approval/,
          );
          collectionId = recovered.collectionId;
        },
      );
      await t.test(
        "an editor cannot self-approve a corrected revision",
        async () => {
          const row = await editor.collection({ id: collectionId });
          const saved = await editor.save({
            collectionId,
            brief: required(row.document.briefs[0]),
            reason: "Synthetic correction requires independent review",
          });
          collectionId = saved.collectionId;
          const current = await editor.collection({ id: collectionId });
          await assert.rejects(
            () =>
              editor.review({
                collectionId,
                revisionId: required(current.document.briefs[0]).revisionId,
                action: "approve",
                policyVersion: version,
                reason: "Self review must be rejected",
              }),
            /independent editor/,
          );
        },
      );
      await t.test(
        "a changed source invalidates prior drafts and policy revocation closes reads",
        async () => {
          const changed = await saveResearchCollection(
            fixture("Changed synthetic source"),
            db,
          );
          assert.equal(changed.changed, true);
          await assert.rejects(
            () => publisher.publish({ collectionId }),
            /superseded/,
          );
          await publisher.revokePolicy({ version });
          assert.equal((await activeResearchPolicy(db)).approved, false);
          assert.equal(await reader.race({ releaseId }), null);
        },
      );
      await t.test(
        "changed source URLs require review even when text is unchanged",
        async () => {
          const moved = fixture("Changed synthetic source");
          const url = "https://example.org/relocated-source";
          required(moved.sources[0]).url = url;
          required(required(moved.briefs[0]).evidence[0]).url = url;
          moved.manifest.rosterSourceUrl = url;
          assert.equal((await saveResearchCollection(moved, db)).changed, true);
        },
      );
    } finally {
      const rows = await db
        .select()
        .from(Collection)
        .where(eq(Collection.pilotKey, pilotKey));
      const ids = rows.flatMap((r) =>
        r.document.briefs.map((b) => b.revisionId),
      );
      await db
        .delete(Release)
        .where(sql`${Release.document}->>'contestId' = ${pilotKey}`);
      if (ids.length) {
        await db.delete(Review).where(inArray(Review.revisionId, ids));
        await db.delete(Revision).where(inArray(Revision.id, ids));
      }
      await db.delete(Collection).where(eq(Collection.pilotKey, pilotKey));
      await db.delete(Policy).where(eq(Policy.version, version));
      await db
        .delete(Editor)
        .where(inArray(Editor.userId, [editorId, publisherId]));
    }
  },
);
