import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const databaseUrl = process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL;
const collectionFile = process.env.CANDIDATE_RESEARCH_COLLECTION_FILE;
const guideFile = process.env.CANDIDATE_RESEARCH_GUIDE_FILE;

void test(
  "collected statewide sources reach the candidate reader only after review and publication",
  { skip: !databaseUrl || !collectionFile || !guideFile },
  async () => {
    assert.ok(databaseUrl && collectionFile && guideFile);
    const target = new URL(databaseUrl);
    assert.ok(
      ["127.0.0.1", "localhost"].includes(target.hostname) &&
        target.pathname.startsWith("/billion_candidate_") &&
        target.pathname.endsWith("_test"),
    );
    process.env.POSTGRES_URL = databaseUrl;
    const { candidateResearchCollectionSchema } =
      await import("@acme/validators");
    const { db } = await import("@acme/db/client");
    const { eq, inArray } = await import("@acme/db");
    const {
      CandidateResearchCollection: Collection,
      CandidateResearchEditor: Editor,
      CandidateResearchPolicy: Policy,
      CandidateRaceRelease: Release,
      CandidateBriefRevision: Revision,
      CandidateBriefReviewEvent: Review,
      CivicApiCache,
    } = await import("@acme/db/schema");
    const {
      officialGuidePayloadSchema,
      officialGuideCacheParams,
      CA_OFFICIAL_GUIDE_ENDPOINT,
      CA_OFFICIAL_GUIDE_ADDRESS_HASH,
    } = await import("./official-guide-cache");
    const {
      saveResearchCollection,
      activeResearchPolicy,
      failResearchRefresh,
    } = await import("./candidate-research-store");
    const { createTRPCRouter } = await import("../trpc");
    const { createCandidateBriefsRouter } =
      await import("../router/candidate-briefs");
    const { candidateResearchEditorialRouter } =
      await import("../router/candidate-research-editorial");
    const document = candidateResearchCollectionSchema.parse(
      JSON.parse(await readFile(collectionFile, "utf8")),
    );
    const payload: unknown = JSON.parse(await readFile(guideFile, "utf8"));
    const envelope = payload as { result?: { data?: { json?: unknown } } };
    const guide = officialGuidePayloadSchema.parse(
      envelope.result?.data?.json ?? payload,
    );
    assert.equal(document.problems.length, 0);
    assert.equal(document.manifest.office, "Lieutenant Governor");
    const editorId = `local-test-editor-${randomUUID()}`;
    const version = `local-verification-only-${randomUUID()}`;
    const context = {
      db,
      session: { user: { id: editorId } },
      authApi: {},
    } as never;
    const editorial = createTRPCRouter(
      candidateResearchEditorialRouter,
    ).createCaller(context);
    const reader = createTRPCRouter(
      createCandidateBriefsRouter(activeResearchPolicy),
    ).createCaller({ db, session: null, authApi: {} } as never);
    const cacheId = randomUUID();
    let collectionId: string | undefined;
    let releaseId: string | undefined;
    const revisions = document.briefs.map((brief) => brief.revisionId);
    try {
      await db.insert(CivicApiCache).values({
        id: cacheId,
        addressHash: CA_OFFICIAL_GUIDE_ADDRESS_HASH,
        endpoint: CA_OFFICIAL_GUIDE_ENDPOINT,
        params: officialGuideCacheParams(guide.electionDate),
        responseData: guide,
        expiresAt: new Date(Date.now() + 3_600_000),
      });
      collectionId = (await saveResearchCollection(document)).collectionId;
      assert.deepEqual(await reader.listRaces(), []);
      assert.equal(
        (
          await reader.forGuideCandidate({
            name: "Fiona Ma",
            officeSlug: "lt-governor",
          })
        ).status,
        "unavailable",
      );
      await assert.rejects(editorial.publish({ collectionId }));
      await db.insert(Editor).values({
        userId: editorId,
        canPublish: true,
        grantedBy: "disposable-local-test",
      });
      await editorial.approvePolicy({
        version,
        statement:
          "Local automated verification only. These review events exercise the release contract and do not approve publication of any real candidate research.",
      });
      await assert.rejects(editorial.publish({ collectionId }));
      for (const revisionId of revisions)
        await editorial.review({
          collectionId,
          revisionId,
          action: "approve",
          policyVersion: version,
          reason:
            "Disposable local verification of the complete source-to-reader lifecycle, not a human editorial approval.",
        });
      releaseId = (await editorial.publish({ collectionId })).releaseId;
      const result = await reader.forGuideCandidate({
        name: "Fiona Ma",
        officeSlug: "lt-governor",
      });
      assert.equal(result.status, "published");
      assert.equal(result.releaseId, releaseId);
      assert.equal(
        result.identity.candidateId,
        "ca-sos:2026-11-03:030000000000:3550",
      );
      assert.equal(result.race.manifest.members.length, 2);
      assert.equal(result.race.briefs.length, 2);
      assert.ok(
        result.race.briefs.every((brief) => brief.research?.promises.length),
      );
      assert.ok(
        result.race.briefs.every(
          (brief) =>
            brief.research?.financeGap && brief.research.finance === null,
        ),
      );
      assert.ok(
        result.race.briefs.every((brief) =>
          brief.evidence.some((e) => e.origin === "candidate"),
        ),
      );
      assert.equal(
        (await reader.race({ releaseId }))?.manifest.members.length,
        2,
      );
      assert.equal(
        (
          await reader.forGuideCandidate({
            name: "Gloria Romero",
            officeSlug: "lt-governor",
          })
        ).status,
        "published",
      );
      assert.equal(
        (
          await reader.forGuideCandidate({
            name: "Fiona Ma",
            officeSlug: "governor",
          })
        ).status,
        "unavailable",
      );
      await failResearchRefresh(
        document.pilotKey,
        "Local source refresh failure test",
      );
      assert.equal(
        (
          await reader.forGuideCandidate({
            name: "Fiona Ma",
            officeSlug: "lt-governor",
          })
        ).status,
        "unavailable",
      );
      assert.equal(await reader.race({ releaseId }), null);
      assert.deepEqual(await reader.listRaces(), []);
    } finally {
      if (releaseId) await db.delete(Release).where(eq(Release.id, releaseId));
      await db.delete(Review).where(inArray(Review.revisionId, revisions));
      if (collectionId)
        await db.delete(Collection).where(eq(Collection.id, collectionId));
      await db.delete(Revision).where(inArray(Revision.id, revisions));
      await db.delete(Policy).where(eq(Policy.version, version));
      await db.delete(Editor).where(eq(Editor.userId, editorId));
      await db.delete(CivicApiCache).where(eq(CivicApiCache.id, cacheId));
    }
  },
);
