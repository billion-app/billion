import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";

import { eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  ContentTranslation,
  ContentTranslationRequest,
  CourtCase,
  GovernmentContent,
} from "@acme/db/schema";

import { loadContentDetail } from "../src/lib/content-detail";
import {
  hashReaderSource,
  readerTranslationSource,
  TRANSLATION_PROMPT_VERSION,
} from "../src/lib/content-translation";
import { processNextTranslation } from "../src/lib/content-translation-store";
import {
  prepareReaderTranslation,
  prepareReaderTranslationPage,
  readerPreparationHasCapacity,
} from "../src/lib/pretranslate-readers";
import { translateContentDetail } from "../src/lib/reader-translation";

void test(
  "full Chinese readers are prepared before opening; revisions cannot reuse old prose",
  {
    skip: !process.env.READER_TRANSLATIONS_TEST_DATABASE_URL,
    timeout: 30_000,
  },
  async () => {
    const databaseUrl = process.env.READER_TRANSLATIONS_TEST_DATABASE_URL;
    assert.ok(databaseUrl);
    const target = new URL(databaseUrl);
    assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
    assert.ok(target.pathname.endsWith("_test"));
    process.env.POSTGRES_URL = target.toString();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const [billId, governmentId, courtId] = ids as [string, string, string];
    const source = {
      title: "English title",
      description: "English summary",
      fullText: "Verbatim official source.",
      aiGeneratedArticle:
        "## Full explanation\n\nA detailed explanation with [source](https://example.org/source).",
    };
    try {
      assert.equal(
        (await db.select().from(ContentTranslationRequest)).length,
        0,
      );
      await db.insert(Bill).values({
        ...source,
        id: billId,
        billNumber: `TEST-${billId}`,
        url: `https://example.org/${billId}`,
        sourceWebsite: "congress.gov",
        actions: [{ date: "2026-10-01", text: "Introduced in House" }],
      });
      await db.insert(GovernmentContent).values({
        ...source,
        id: governmentId,
        type: "Executive Order",
        publishedDate: new Date(),
        url: `https://example.org/${governmentId}`,
      });
      await db.insert(CourtCase).values({
        ...source,
        id: courtId,
        caseNumber: `TEST-${courtId}`,
        court: "Supreme Court",
        url: `https://example.org/${courtId}`,
      });
      // No getById/getTranslation call has happened. The publishing hook / sweep
      // creates work using exactly the text the reader will receive.
      for (const id of ids)
        assert.equal(await prepareReaderTranslation(id), false);
      const queued = await db.select().from(ContentTranslationRequest);
      assert.equal(queued.length, 3);
      for (const row of queued) {
        assert.equal(row.language, "zh");
        assert.ok(row.segments.some((s) => s.key === "articleContent"));
        assert.ok(!row.segments.some((s) => s.text === source.fullText));
      }
      for (let i = 0; i < 3; i++)
        assert.equal(
          await processNextTranslation({
            modelVersion: `${TRANSLATION_PROMPT_VERSION}:test`,
            translateBatch: (texts) =>
              Promise.resolve(texts.map((t) => `中文 ${t}`)),
          }),
          "generated",
        );
      for (const id of ids) {
        const detail = await loadContentDetail({ id });
        const result = await translateContentDetail(detail, "zh");
        assert.equal(result.status, "translated");

        assert.ok(result.articleContent);
        assert.match(result.articleContent, /^中文/);
        assert.ok(result.articleContent.includes("https://example.org/source"));
        assert.equal(detail.originalContent, source.fullText);
        assert.equal(await prepareReaderTranslation(id), true);
      }
      assert.equal(
        (await db.select().from(ContentTranslationRequest)).length,
        0,
      );
      const old = await loadContentDetail({ id: billId });
      await db
        .update(Bill)
        .set({ aiGeneratedArticle: "Changed complete explanation" })
        .where(eq(Bill.id, billId));
      assert.equal(await prepareReaderTranslation(billId), false);
      const changed = await loadContentDetail({ id: billId });
      assert.equal(
        (
          await translateContentDetail(
            changed,
            "zh",
            hashReaderSource(readerTranslationSource(old)),
          )
        ).status,
        "stale",
      );
      assert.equal(
        (await translateContentDetail(changed, "zh")).status,
        "unavailable",
      );
      const retries = Array.from({ length: 20 }, () => randomUUID());
      ids.push(...retries);
      await db.insert(ContentTranslationRequest).values(
        retries.map((id) => ({
          contentId: id,
          contentType: "bill",
          language: "zh",
          sourceHash: "f".repeat(64),
          segments: [{ key: "title", text: "Retrying" }],
          attempts: 5,
          availableAt: new Date(Date.now() + 30 * 60_000),
        })),
      );
      assert.equal(
        await readerPreparationHasCapacity(),
        true,
        "backoff rows cannot starve archive preparation",
      );
      await db
        .update(ContentTranslationRequest)
        .set({ availableAt: new Date(0) })
        .where(inArray(ContentTranslationRequest.contentId, retries));
      assert.equal(
        await readerPreparationHasCapacity(),
        false,
        "runnable work bounds background preparation",
      );
      await db
        .update(ContentTranslationRequest)
        .set({
          availableAt: new Date(Date.now() + 15 * 60_000),
          claimId: randomUUID(),
        })
        .where(inArray(ContentTranslationRequest.contentId, retries));
      assert.equal(
        await readerPreparationHasCapacity(),
        false,
        "active leases also count toward the limit",
      );
      await assert.rejects(prepareReaderTranslationPage({ limit: 101 }));
    } finally {
      await db
        .delete(ContentTranslationRequest)
        .where(inArray(ContentTranslationRequest.contentId, ids));
      await db
        .delete(ContentTranslation)
        .where(inArray(ContentTranslation.contentId, ids));
      await db.delete(Bill).where(eq(Bill.id, billId));
      await db
        .delete(GovernmentContent)
        .where(eq(GovernmentContent.id, governmentId));
      await db.delete(CourtCase).where(eq(CourtCase.id, courtId));
      await (db as typeof db & { $client: Pool }).$client.end();
    }
  },
);
