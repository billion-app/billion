import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";

import { inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { ContentTranslation, ContentTranslationRequest } from "@acme/db/schema";

import { localizeContentCards } from "./card-translation";
import { readyCardTranslations } from "./card-translation-status";
import { CARD_TRANSLATION_PROMPT_VERSION } from "./content-translation";

const databaseUrl = process.env.TRANSLATIONS_TEST_DATABASE_URL;
void test(
  "card readiness preserves language, revision, completeness and private scope",
  {
    skip: !databaseUrl,
  },
  async () => {
    assert.ok(databaseUrl);
    const target = new URL(databaseUrl);
    assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
    assert.ok(target.pathname.endsWith("_test"));
    process.env.POSTGRES_URL = target.toString();
    const cards = Array.from({ length: 6 }, (_, i) => ({
      id: randomUUID(),
      type: "bill" as const,
      title: `Title ${i}`,
      description: "Summary",
    }));
    const pending = await localizeContentCards(cards, "es");
    const lookups = pending.flatMap((card) =>
      card.translationLookup ? [card.translationLookup] : [],
    );
    assert.equal(lookups.length, cards.length);
    const first = lookups[0];
    assert.ok(first);
    try {
      assert.deepEqual(
        await readyCardTranslations({ language: "es", lookups }),
        [],
      );
      await db.insert(ContentTranslation).values(
        lookups.map((lookup, i) => ({
          contentId: lookup.contentId,
          contentType: i === 5 ? "notification" : "bill",
          language: i === 1 ? "zh" : "es",
          sourceHash: i === 2 ? "0".repeat(64) : lookup.sourceHash,
          payload: {
            "card.title": "Título",
            "card.description": i === 3 ? " \n\t" : "Resumen",
          },
          modelVersion:
            i === 4
              ? "old-card-prompt:model"
              : `${CARD_TRANSLATION_PROMPT_VERSION}:test`,
        })),
      );
      assert.deepEqual(
        await readyCardTranslations({ language: "es", lookups }),
        [
          {
            contentId: first.contentId,
            sourceHash: first.sourceHash,
          },
        ],
      );
      const firstCard = cards[0];
      assert.ok(firstCard);
      const ready = await localizeContentCards([firstCard], "es");
      const translated = ready[0];
      assert.ok(translated);
      assert.equal(translated.translationState, "translated");
      assert.equal(translated.translationLookup, undefined);
      assert.equal(translated.title, "Título");
    } finally {
      const ids = lookups.map((lookup) => lookup.contentId);
      await db
        .delete(ContentTranslation)
        .where(inArray(ContentTranslation.contentId, ids));
      await db
        .delete(ContentTranslationRequest)
        .where(inArray(ContentTranslationRequest.contentId, ids));
      await (db as unknown as { $client: Pool }).$client.end();
    }
  },
);
