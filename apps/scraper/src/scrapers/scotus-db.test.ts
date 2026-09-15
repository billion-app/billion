import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { eq } from "@acme/db";
import { ContentLens, CourtCase } from "@acme/db/schema";

import { createNewItemLimiter } from "../utils/new-item-limit.js";

void test(
  "a court source refresh preserves legacy IDs and retries stale explanations after a budget deferral",
  {
    skip: !process.env.SCOTUS_TEST_POSTGRES_URL,
  },
  async () => {
    const url = process.env.SCOTUS_TEST_POSTGRES_URL!;
    assert.ok(
      ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname),
      "This fixture test only writes to a local database",
    );
    process.env.POSTGRES_URL = url;
    const { upsertContent } = await import("../utils/db/operations.js");
    const { db } = await import("@acme/db/client");
    const id = randomUUID();
    const caseNumber = `TEST-${id}`;
    try {
      await db.insert(CourtCase).values({
        id,
        caseNumber,
        title: "Local identity test fixture",
        court: "HTTPS://WWW.COURTLISTENER.COM/API/REST/V4/COURTS/SCOTUS/",
        description: "Old fixture summary",
        aiGeneratedArticle: "Old fixture article",
        url: "https://www.courtlistener.com/fixture/",
        contentHash: "old-hash",
      });
      await db.insert(ContentLens).values({
        contentType: "court_case",
        contentId: id,
        contentHash: "old-hash",
        modelVersion: "fixture",
        lensData: {
          left: { stance: "Old ruling supported", points: [] },
          right: { stance: "Old ruling opposed", points: [] },
          sources: [],
          generatedAt: new Date().toISOString(),
          modelVersion: "fixture",
        },
      });
      const input = {
        type: "court_case" as const,
        data: {
          caseNumber,
          title: "Local identity test fixture",
          court: "Supreme Court of the United States",
          fullText:
            "This is local test fixture source text about a published court decision. ".repeat(
              100,
            ),
          url: "https://www.supremecourt.gov/opinions/25pdf/fixture.pdf",
          filedDate: new Date("2026-09-14"),
          status: "Published opinion or order",
        },
      };
      const outcome = await upsertContent(input, {
        newItemLimiter: createNewItemLimiter(0),
      });
      assert.deepEqual(outcome, {
        status: "deferred",
        reason: "run budget reached",
      });
      const rows = await db
        .select({
          id: CourtCase.id,
          court: CourtCase.court,
          description: CourtCase.description,
          aiGeneratedArticle: CourtCase.aiGeneratedArticle,
        })
        .from(CourtCase)
        .where(eq(CourtCase.caseNumber, caseNumber));
      assert.equal(rows.length, 1);
      assert.ok(rows[0]);
      assert.equal(rows[0].id, id);
      assert.equal(rows[0].court, input.data.court);
      assert.equal(rows[0].description, null);
      assert.equal(rows[0].aiGeneratedArticle, null);
      // The source hash now matches. Missing derived text must still request a
      // generation slot on the next scan, rather than reuse the stale article.
      assert.deepEqual(
        await upsertContent(input, { newItemLimiter: createNewItemLimiter(0) }),
        { status: "deferred", reason: "run budget reached" },
      );
      const { createCaller } = await import("@acme/api");
      const api = createCaller({ db, session: null, authApi: {} as never });
      const detail = await api.content.getById({ id });
      assert.equal(detail.id, id);
      assert.equal(detail.originalContent, input.data.fullText);
      assert.equal(detail.articleContent, input.data.fullText);
      assert.equal(detail.isAIGenerated, false);
      assert.equal(detail.url, input.data.url);
      assert.equal(detail.lensData, null);
      assert.deepEqual(
        await db
          .select({ id: ContentLens.id })
          .from(ContentLens)
          .where(eq(ContentLens.contentId, id)),
        [],
      );
      const results = await api.content.search({
        query: caseNumber,
        type: "court_case",
        limit: 10,
      });
      assert.equal(results.length, 1);
      assert.equal(results[0]?.id, id);
    } finally {
      // Only the UUID created by this test is removed. No user rows are touched.
      try {
        await db.delete(ContentLens).where(eq(ContentLens.contentId, id));
        await db.delete(CourtCase).where(eq(CourtCase.id, id));
      } finally {
        await (
          db as typeof db & { $client: { end(): Promise<void> } }
        ).$client.end();
      }
    }
  },
);
