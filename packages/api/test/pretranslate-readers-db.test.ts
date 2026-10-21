import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";

import { eq, inArray, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  ContentBrief,
  ContentLens,
  ContentTranslation,
  ContentTranslationRequest,
  CourtCase,
  GovernmentContent,
} from "@acme/db/schema";
import { BILL_BRIEF_VERSION, BillBriefRecordSchema } from "@acme/validators";

import { loadContentDetail } from "../src/lib/content-detail";
import {
  hashReaderSource,
  readerTranslationSource,
  TRANSLATION_PROMPT_VERSION,
} from "../src/lib/content-translation";
import { processNextTranslation } from "../src/lib/content-translation-store";
import {
  createReaderTranslationPreparer,
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
  async (t) => {
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
      let now = Date.now();
      const preparePage = createReaderTranslationPreparer(() => now);
      const sweep = async () => {
        const page = await preparePage({ limit: 100 });
        assert.equal(page.scanned, 3);
        assert.equal(page.ready + page.queued + page.failed + page.skipped, 3);
        assert.equal(page.complete, true);
        return page;
      };
      const generate = () =>
        processNextTranslation({
          modelVersion: `${TRANSLATION_PROMPT_VERSION}:test`,
          translateBatch: (texts) =>
            Promise.resolve(texts.map((text) => `中文 ${text}`)),
        });
      const repairChangedReader = async () => {
        const pending = await sweep();
        assert.equal(pending.queued, 1);
        assert.equal(pending.skipped, 2);
        assert.equal(await generate(), "generated");
        assert.equal((await sweep()).ready, 1);
        assert.equal((await sweep()).skipped, 3);
      };
      await t.test(
        "ready readers skip repeated heavy preparation, including paginated sweeps",
        async () => {
          assert.equal((await sweep()).ready, 3);
          assert.equal((await sweep()).skipped, 3);
          const first = await preparePage({ limit: 2 });
          assert.equal(first.skipped, 2);
          assert.equal(first.complete, false);
          const second = await preparePage({ limit: 2, after: first.after });
          assert.equal(second.skipped, 1);
          assert.equal(second.complete, true);
        },
      );
      await t.test(
        "all source types invalidate after raw SQL edits without timestamps",
        async () => {
          await db.execute(
            sql`update ${Bill} set title = 'Revised bill title' where id = ${billId}`,
          );
          await db.execute(
            sql`update ${GovernmentContent} set title = 'Revised government title' where id = ${governmentId}`,
          );
          await db.execute(
            sql`update ${CourtCase} set title = 'Revised court title' where id = ${courtId}`,
          );
          assert.equal((await sweep()).queued, 3);
          for (let i = 0; i < 3; i++)
            assert.equal(await generate(), "generated");
          assert.equal((await sweep()).ready, 3);
          assert.equal((await sweep()).skipped, 3);
        },
      );
      await t.test(
        "brief insertion, raw update, and deletion invalidate ready readers",
        async () => {
          const brief = BillBriefRecordSchema.parse({
            version: BILL_BRIEF_VERSION,
            legalStatus: "proposed",
            verifiedQuotes: 0,
            generatedAt: new Date(now).toISOString(),
            modelVersion: "test",
            summary: "The bill would fund additional public transit routes.",
            hook: "The bill would fund new public transit routes for local residents. The size of each award is not yet known.",
            facts: [],
            changes: [
              {
                kind: "funds",
                title: "Additional transit routes",
                before: "Existing routes remain available.",
                after: "More routes would receive funding.",
              },
            ],
            affected: [
              {
                group: "Transit riders",
                takeaway: "Transit riders could use additional routes.",
                effect: "Funding would support new transit routes.",
                direction: "gains",
              },
            ],
            unknowns: ["The amount for each route is not yet known."],
            terms: [],
            reading: [],
          });
          await db.insert(ContentBrief).values({
            contentId: billId,
            contentType: "bill",
            contentHash: "a".repeat(64),
            brief,
            modelVersion: "test",
          });
          await repairChangedReader();
          await db.execute(
            sql`update ${ContentBrief} set brief = jsonb_set(brief, '{summary}', '"The revised bill would fund additional transit routes."'::jsonb) where content_id = ${billId}`,
          );
          await repairChangedReader();
          await db
            .delete(ContentBrief)
            .where(eq(ContentBrief.contentId, billId));
          await repairChangedReader();
        },
      );
      await t.test(
        "lens insertion, raw update, and deletion invalidate ready readers",
        async () => {
          await db.insert(ContentLens).values({
            contentId: billId,
            contentType: "bill",
            contentHash: "a".repeat(64),
            modelVersion: "test",
            lensData: {
              left: { stance: "Supporters favor more routes", points: [] },
              right: { stance: "Critics question the cost", points: [] },
              sources: [],
              generatedAt: new Date(now).toISOString(),
              modelVersion: "test",
            },
          });
          await repairChangedReader();
          await db.execute(
            sql`update ${ContentLens} set lens_data = jsonb_set(lens_data, '{left,stance}', '"Supporters favor expanded service"'::jsonb) where content_id = ${billId}`,
          );
          await repairChangedReader();
          await db.delete(ContentLens).where(eq(ContentLens.contentId, billId));
          await repairChangedReader();
        },
      );
      await t.test(
        "deleted or corrupt cached translations are repaired",
        async () => {
          await db
            .delete(ContentTranslation)
            .where(eq(ContentTranslation.contentId, billId));
          await repairChangedReader();
          await db.execute(
            sql`update ${ContentTranslation} set payload = '{}'::jsonb where content_id = ${billId}`,
          );
          await repairChangedReader();
        },
      );
      await t.test(
        "failed preparation and lost queue entries retry without a source change",
        async () => {
          await db.execute(
            sql`update ${Bill} set title = 'Retry this changed bill' where id = ${billId}`,
          );
          await db.execute(
            sql`create function fail_reader_test_queue() returns trigger language plpgsql as $$ begin raise exception 'fixture queue failure'; end $$`,
          );
          await db.execute(
            sql`create trigger fail_reader_test_queue before insert on content_translation_request for each row execute function fail_reader_test_queue()`,
          );
          try {
            assert.equal((await sweep()).failed, 1);
            assert.equal((await sweep()).failed, 1);
          } finally {
            await db.execute(
              sql`drop trigger fail_reader_test_queue on content_translation_request`,
            );
            await db.execute(sql`drop function fail_reader_test_queue()`);
          }
          assert.equal((await sweep()).queued, 1);
          await db
            .delete(ContentTranslationRequest)
            .where(eq(ContentTranslationRequest.contentId, billId));
          await repairChangedReader();
        },
      );
      await t.test(
        "daily repair, worker restart, and explicit preparation validate full readers",
        async () => {
          now += 24 * 60 * 60_000;
          assert.equal((await sweep()).ready, 3);
          assert.equal((await sweep()).skipped, 3);
          assert.equal(
            (await createReaderTranslationPreparer()({ limit: 100 })).ready,
            3,
          );
          assert.equal(
            (await prepareReaderTranslationPage({ limit: 100 })).ready,
            3,
          );
        },
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
      await db.delete(ContentBrief).where(inArray(ContentBrief.contentId, ids));
      await db.delete(ContentLens).where(inArray(ContentLens.contentId, ids));
      await db.delete(Bill).where(eq(Bill.id, billId));
      await db
        .delete(GovernmentContent)
        .where(eq(GovernmentContent.id, governmentId));
      await db.delete(CourtCase).where(eq(CourtCase.id, courtId));
      await (db as typeof db & { $client: Pool }).$client.end();
    }
  },
);
