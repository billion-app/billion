import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { and, eq } from "@acme/db";
import { ContentBrief, ContentLens, CourtCase } from "@acme/db/schema";
import { parseCourtBriefRecord } from "@acme/validators";

import { generateCourtBrief } from "../../../apps/scraper/src/utils/ai/court-brief.js";
import {
  emergency,
  emergencyOutput,
  fixtureModel,
} from "../../../apps/scraper/src/utils/ai/fixtures/court-brief-fixtures.js";
import { createNewItemLimiter } from "../../../apps/scraper/src/utils/new-item-limit.js";

void test(
  "source → real generation/validation → stored court brief → tRPC, with cache and fallback regressions",
  { skip: !process.env.SCOTUS_TEST_POSTGRES_URL },
  async () => {
    const url = process.env.SCOTUS_TEST_POSTGRES_URL;
    assert.ok(url);
    assert.ok(
      ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname),
      "Court fixture writes require a local database",
    );
    process.env.POSTGRES_URL = url;
    // Test-controlled constant, not an input to Turbo's cache.
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    process.env.SCRAPER_SKIP_DUAL_LENS = "1";
    const { upsertContent, upsertCourtBrief } =
      await import("../../../apps/scraper/src/utils/db/operations.js");
    const { db } = await import("@acme/db/client");
    const { createCaller } = await import("../src/root");
    const api = createCaller({ db, session: null, authApi: {} as never });
    const id = randomUUID();
    const data = { ...emergency.data };
    const input = { type: "court_case" as const, data };
    const model = fixtureModel([
      emergencyOutput,
      emergencyOutput,
      emergencyOutput,
      emergencyOutput,
    ]);
    const generator = (args: Parameters<typeof generateCourtBrief>[0]) =>
      generateCourtBrief(args, model);
    const lensData = {
      framing: "proponent_opponent" as const,
      left: { stance: "Supporters argue", points: [] },
      right: { stance: "Critics argue", points: [] },
      sources: [],
      generatedAt: "2026-09-14T00:00:00.000Z",
      modelVersion: "fixture",
    };
    const artifact = (name: string, detail: unknown) => {
      if (process.env.COURT_BRIEF_TEST_ARTIFACT_DIR)
        writeFileSync(
          join(process.env.COURT_BRIEF_TEST_ARTIFACT_DIR, `${name}.json`),
          JSON.stringify(detail),
        );
    };
    try {
      const existing = await db
        .select({ id: CourtCase.id })
        .from(CourtCase)
        .where(
          and(
            eq(CourtCase.caseNumber, data.caseNumber),
            eq(CourtCase.court, data.court),
          ),
        );
      assert.equal(
        existing.length,
        0,
        "Use an empty fixture database; this test will not modify an existing 26A305 row",
      );
      const newInput = {
        ...input,
        data: { ...data, caseNumber: `TEST-NEW-${id}` },
      };
      assert.deepEqual(
        await upsertContent(newInput, {
          newItemLimiter: createNewItemLimiter(0),
          courtBriefGenerator: generator,
        }),
        { status: "deferred", reason: "run budget reached" },
      );
      assert.deepEqual(
        await upsertContent(newInput, {
          newItemLimiter: createNewItemLimiter(1),
          courtBriefGenerator: () => Promise.resolve(null),
        }),
        { status: "deferred", reason: "enrichment did not complete" },
      );
      const partialRows = await db
        .select({ id: CourtCase.id })
        .from(CourtCase)
        .where(eq(CourtCase.caseNumber, newInput.data.caseNumber));
      assert.equal(partialRows.length, 0);
      assert.deepEqual(
        await upsertContent({
          ...newInput,
          data: { ...newInput.data, fullText: null },
        }),
        { status: "deferred", reason: "court source text unavailable" },
      );
      await db.insert(CourtCase).values({
        id,
        ...data,
        description: "Legacy summary",
        aiGeneratedArticle: "Legacy Markdown explanation",
        thumbnailUrl: "https://example.org/existing.png",
        contentHash: "old",
      });
      // Production lenses use a derived cache key, not CourtCase.contentHash.
      // Source refreshes delete stale court lenses atomically, so the API must
      // return any row that remains rather than comparing incompatible hashes.
      await db.insert(ContentLens).values({
        contentType: "court_case",
        contentId: id,
        contentHash: "lens-cache-key",
        lensData,
        modelVersion: "fixture",
      });
      const missing = await api.content.getById({ id });
      assert.equal(missing.type, "court_case");
      assert.equal("brief" in missing, false);
      assert.equal(missing.courtBrief, null);
      assert.deepEqual(missing.lensData, lensData);
      assert.equal(missing.articleContent, "Legacy Markdown explanation");
      artifact("missing", missing);

      const limiter = createNewItemLimiter(1);
      assert.deepEqual(
        await upsertContent(input, {
          newItemLimiter: limiter,
          courtBriefGenerator: generator,
        }),
        { status: "written", id },
      );
      assert.equal(model.doGenerateCalls.length, 1);
      const briefWhere = and(
        eq(ContentBrief.contentId, id),
        eq(ContentBrief.contentType, "court_case"),
      );
      const stored = await db.select().from(ContentBrief).where(briefWhere);
      assert.equal(stored.length, 1);
      assert.ok(stored[0]);
      const storedBrief = parseCourtBriefRecord(
        stored[0].brief,
        stored[0].contentHash,
      );
      assert.ok(storedBrief);
      const detail = await api.content.getById({ id });
      assert.ok(detail.type === "court_case" && detail.courtBrief);
      assert.equal(detail.courtBrief.action.text, emergencyOutput.action.text);
      assert.equal(detail.courtBrief.proceeding, "emergency_order");
      assert.equal(detail.originalContent, data.fullText);
      assert.equal(detail.articleContent, data.fullText);
      assert.equal(detail.description, emergencyOutput.takeaway.text);
      assert.equal(detail.isAIGenerated, true);
      assert.equal(detail.courtBrief.verifiedQuotes, 1);
      artifact("valid", detail);
      // No article or summary generator is injected. Any redundant call would fail
      // without provider credentials; exactly one structured-model call occurred.
      assert.deepEqual(
        await upsertContent(input, {
          newItemLimiter: createNewItemLimiter(0),
          courtBriefGenerator: generator,
        }),
        { status: "written", id },
      );
      assert.equal(model.doGenerateCalls.length, 1);

      await db
        .update(ContentBrief)
        // @ts-expect-error Deliberately persist an obsolete version to test rejection.
        .set({ brief: { ...storedBrief, generatorVersion: "old" } })
        .where(briefWhere);
      const invalid = await api.content.getById({ id });
      assert.equal(invalid.type === "court_case" && invalid.courtBrief, null);
      artifact("invalid", invalid);
      assert.deepEqual(
        await upsertContent(input, {
          newItemLimiter: createNewItemLimiter(0),
          courtBriefGenerator: generator,
        }),
        { status: "deferred", reason: "run budget reached" },
      );
      assert.deepEqual(
        await upsertContent(input, {
          newItemLimiter: createNewItemLimiter(1),
          courtBriefGenerator: generator,
        }),
        { status: "written", id },
      );
      assert.equal(model.doGenerateCalls.length, 2);

      const changed = {
        ...input,
        data: {
          ...data,
          fullText: `${data.fullText}\nRevision fixture: the merits remain unresolved.`,
        },
      };
      assert.deepEqual(
        await upsertContent(changed, {
          newItemLimiter: createNewItemLimiter(0),
          courtBriefGenerator: generator,
        }),
        { status: "deferred", reason: "run budget reached" },
      );
      const stale = await api.content.getById({ id });
      assert.equal(stale.type === "court_case" && stale.courtBrief, null);
      assert.equal(stale.articleContent, changed.data.fullText);
      assert.equal(stale.isAIGenerated, false);
      artifact("stale", stale);
      const hashes = await db
        .select({ contentHash: CourtCase.contentHash })
        .from(CourtCase)
        .where(eq(CourtCase.id, id));
      assert.ok(hashes[0]);
      const args = {
        contentId: id,
        contentHash: hashes[0].contentHash,
        data: changed.data,
      };
      assert.equal(
        await upsertCourtBrief(args, () => Promise.resolve(null)),
        false,
      );
      assert.equal(await upsertCourtBrief(args, generator), true);
      assert.equal(model.doGenerateCalls.length, 3);
      const refreshed = await api.content.getById({ id });
      assert.ok(refreshed.type === "court_case" && refreshed.courtBrief);

      // A source refresh clears the prior description before regenerating the
      // brief. Even when the takeaway text is unchanged, phase two must restore
      // that subtitle instead of comparing against the pre-refresh row.
      await db
        .update(CourtCase)
        .set({ description: emergencyOutput.takeaway.text })
        .where(eq(CourtCase.id, id));
      const refreshedAgain = {
        ...changed,
        data: {
          ...changed.data,
          fullText: `${changed.data.fullText}\nSecond revision fixture: no change to the takeaway.`,
        },
      };
      assert.deepEqual(
        await upsertContent(refreshedAgain, {
          newItemLimiter: createNewItemLimiter(1),
          courtBriefGenerator: generator,
        }),
        { status: "written", id },
      );
      assert.equal(model.doGenerateCalls.length, 4);
      const [subtitle] = await db
        .select({ description: CourtCase.description })
        .from(CourtCase)
        .where(eq(CourtCase.id, id));
      assert.equal(subtitle?.description, emergencyOutput.takeaway.text);
    } finally {
      try {
        await db.delete(ContentLens).where(eq(ContentLens.contentId, id));
        await db
          .delete(ContentBrief)
          .where(
            and(
              eq(ContentBrief.contentId, id),
              eq(ContentBrief.contentType, "court_case"),
            ),
          );
        await db.delete(CourtCase).where(eq(CourtCase.id, id));
      } finally {
        await (
          db as typeof db & { $client: { end(): Promise<void> } }
        ).$client.end();
      }
    }
  },
);
