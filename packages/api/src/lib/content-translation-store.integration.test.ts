import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";

import { eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { ContentTranslation, ContentTranslationRequest } from "@acme/db/schema";

import {
  getSegmentTranslations,
  getTranslations,
  processNextTranslation,
} from "./content-translation-store";

const databaseUrl = process.env.TRANSLATIONS_TEST_DATABASE_URL;
void test(
  "translation queue, leases, revisions and retries",
  { skip: !databaseUrl, timeout: 30_000 },
  async (t) => {
    assert.ok(databaseUrl);
    const target = new URL(databaseUrl);
    assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
    assert.ok(target.pathname.endsWith("_test"));
    process.env.POSTGRES_URL = target.toString();
    assert.equal((await db.select().from(ContentTranslationRequest)).length, 0);
    assert.equal((await db.select().from(ContentTranslation)).length, 0);
    const input = {
      contentId: randomUUID(),
      contentType: "bill" as const,
      language: "es" as const,
      source: {
        title: "First",
        description: 'A "source quotation" remains.',
        articleContent: null,
        brief: null,
        courtBrief: null,
      },
    };
    const translated = (texts: string[]) =>
      Promise.resolve(texts.map((text) => `ES ${text}`));
    const worker = (translateBatch = translated) =>
      processNextTranslation({ translateBatch, modelVersion: "test:codex" });
    try {
      await t.test(
        "concurrent readers enqueue once; concurrent workers claim once",
        async () => {
          await Promise.all([getTranslations(input), getTranslations(input)]);
          assert.equal(
            (await db.select().from(ContentTranslationRequest)).length,
            1,
          );
          let release!: () => void;
          const hold = new Promise<void>((resolve) => {
            release = resolve;
          });
          let started!: () => void;
          const start = new Promise<void>((resolve) => {
            started = resolve;
          });
          const first = worker(async (texts) => {
            started();
            await hold;
            return translated(texts);
          });
          await start;
          assert.equal(await worker(), "idle");
          await getTranslations(input);
          assert.equal(
            await worker(),
            "idle",
            "polling preserves active lease",
          );
          release();
          assert.equal(await first, "generated");
          const cached = await getTranslations(input);
          assert.equal(cached?.title, "ES First");
          assert.ok(cached.description?.includes('"source quotation"'));
          assert.equal(await worker(), "idle", "cached reads do not enqueue");
        },
      );
      await t.test(
        "failures back off, including across repeated readers",
        async () => {
          input.source.title = "Second";
          await getTranslations(input);
          assert.equal(
            await worker(() => Promise.reject(new Error("provider failure"))),
            "retry",
          );
          const [before] = await db.select().from(ContentTranslationRequest);
          await getTranslations(input);
          const [after] = await db.select().from(ContentTranslationRequest);
          assert.equal(
            after?.availableAt.getTime(),
            before?.availableAt.getTime(),
          );
          assert.equal(after?.attempts, 1);
          assert.equal(await worker(), "idle");
        },
      );
      await t.test(
        "new revision supersedes claimed work and publishes only current source",
        async () => {
          input.source.title = "Third";
          await getTranslations(input);
          assert.equal(
            await worker(async (texts) => {
              input.source.title = "Fourth";
              await getTranslations(input);
              return translated(texts);
            }),
            "superseded",
          );
          const [cache] = await db.select().from(ContentTranslation);
          assert.equal(
            (cache?.payload as Record<string, string>).title,
            "ES First",
          );
          assert.equal(await worker(), "generated");
          assert.equal((await getTranslations(input))?.title, "ES Fourth");
        },
      );
      await t.test("an expired lease can be reclaimed", async () => {
        input.source.title = "Fifth";
        await getTranslations(input);
        await db.update(ContentTranslationRequest).set({
          claimId: randomUUID(),
          availableAt: sql`now() - interval '1 second'`,
          attempts: 1,
        });
        assert.equal(await worker(), "generated");
        assert.equal((await getTranslations(input))?.title, "ES Fifth");
      });
      await t.test(
        "measure segments use the same durable worker without an article record",
        async () => {
          const measureInput = {
            contentId: input.contentId,
            contentType: "measure" as const,
            language: "zh" as const,
            segments: [{ key: "graph.summary.text", text: "Funds housing" }],
          };
          assert.equal(await getSegmentTranslations(measureInput), null);
          assert.equal(
            await worker((texts) =>
              Promise.resolve(texts.map((text) => `中文 ${text}`)),
            ),
            "generated",
          );
          assert.deepEqual(await getSegmentTranslations(measureInput), {
            "graph.summary.text": "中文 Funds housing",
          });
          assert.equal(await worker(), "idle");
        },
      );
    } finally {
      await db
        .delete(ContentTranslationRequest)
        .where(eq(ContentTranslationRequest.contentId, input.contentId));
      await db
        .delete(ContentTranslation)
        .where(eq(ContentTranslation.contentId, input.contentId));
      await (db as typeof db & { $client: Pool }).$client.end();
    }
  },
);
