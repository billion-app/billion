/**
 * Cached article translations. The LLM runs once per content item and
 * language, then again only when the English input (and so `sourceHash`)
 * changes. See content-translation.ts for what is and is not translated.
 */

import { z } from "zod/v4";

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { ContentTranslation } from "@acme/db/schema";

import type {
  TranslationLanguage,
  TranslationSource,
} from "./content-translation";
import {
  hashSegments,
  llmTranslateBatch,
  modelVersion,
  sourceSegments,
  translateSegments,
} from "./content-translation";

const payloadSchema = z.record(z.string(), z.string());

// Two readers opening the same new article should pay for one translation.
const inFlight = new Map<string, Promise<Record<string, string> | null>>();

export async function getTranslations(input: {
  contentId: string;
  contentType: "bill" | "government_content" | "court_case";
  language: TranslationLanguage;
  source: TranslationSource;
}): Promise<Record<string, string> | null> {
  const segments = sourceSegments(input.source);
  const sourceHash = hashSegments(segments);

  const [row] = await db
    .select({
      sourceHash: ContentTranslation.sourceHash,
      payload: ContentTranslation.payload,
    })
    .from(ContentTranslation)
    .where(
      and(
        eq(ContentTranslation.contentId, input.contentId),
        eq(ContentTranslation.language, input.language),
      ),
    )
    .limit(1);
  if (row?.sourceHash === sourceHash) {
    const parsed = payloadSchema.safeParse(row.payload);
    if (parsed.success) return parsed.data;
  }

  const version = modelVersion();
  if (!version) return null;

  const key = `${input.contentId}:${input.language}:${sourceHash}`;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const work = (async () => {
    try {
      const payload = await translateSegments(
        segments,
        input.language,
        llmTranslateBatch,
      );
      await db
        .insert(ContentTranslation)
        .values({
          contentId: input.contentId,
          contentType: input.contentType,
          language: input.language,
          sourceHash,
          payload,
          modelVersion: version,
        })
        .onConflictDoUpdate({
          target: [ContentTranslation.contentId, ContentTranslation.language],
          set: { sourceHash, payload, modelVersion: version },
        });
      return payload;
    } catch (error) {
      // The reader falls back to English; a failed translation is not an
      // error page.
      console.error(
        `[content-translation] ${input.contentId} ${input.language} failed:`,
        error,
      );
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, work);
  return work;
}
