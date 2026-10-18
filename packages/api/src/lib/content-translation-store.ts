/** Vercel serves cached translations and queues misses; big-mac owns generation. */
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";

import { and, asc, eq, inArray, lte, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { ContentTranslation, ContentTranslationRequest } from "@acme/db/schema";

import type {
  Segment,
  TranslateBatch,
  TranslationLanguage,
  TranslationSource,
} from "./content-translation";
import {
  hashSegments,
  sourceSegments,
  translateSegments,
  TRANSLATION_PROMPT_VERSION,
  translationPromptVersion,
} from "./content-translation";

const payloadSchema = z.record(z.string(), z.string());

export async function getTranslations(input: {
  contentId: string;
  contentType: "bill" | "government_content" | "court_case";
  language: TranslationLanguage;
  source: TranslationSource;
}): Promise<Record<string, string> | null> {
  return getSegmentTranslations({
    ...input,
    segments: sourceSegments(input.source),
  });
}

export interface SegmentTranslationRequest {
  contentId: string;
  contentType: "bill" | "government_content" | "court_case" | "measure";
  language: TranslationLanguage;
  segments: Segment[];
}

export async function getSegmentTranslations(input: SegmentTranslationRequest) {
  const [result] = await getSegmentTranslationsMany([input]);
  return result ?? null;
}

/** One cache read and one deduplicated queue write for a page of cards. */
export async function getSegmentTranslationsMany(
  inputs: SegmentTranslationRequest[],
) {
  if (!inputs.length) return [];
  const rows = await db
    .select()
    .from(ContentTranslation)
    .where(
      and(
        inArray(
          ContentTranslation.contentId,
          inputs.map((input) => input.contentId),
        ),
        inArray(
          ContentTranslation.language,
          inputs.map((input) => input.language),
        ),
      ),
    );
  const cached = new Map(
    rows.map((row) => [`${row.contentId}:${row.language}`, row]),
  );
  const misses = new Map<
    string,
    SegmentTranslationRequest & { sourceHash: string }
  >();
  const results = inputs.map((input) => {
    const sourceHash = hashSegments(input.segments);
    const key = `${input.contentId}:${input.language}`;
    const row = cached.get(key);
    if (
      row?.sourceHash === sourceHash &&
      row.modelVersion.startsWith(
        `${translationPromptVersion(input.segments)}:`,
      )
    ) {
      const parsed = payloadSchema.safeParse(row.payload);
      if (
        parsed.success &&
        input.segments.every((segment) => !!parsed.data[segment.key]?.trim())
      )
        return parsed.data;
    }
    misses.set(key, { ...input, sourceHash });
    return null;
  });
  if (misses.size) {
    await db
      .insert(ContentTranslationRequest)
      .values([...misses.values()])
      .onConflictDoUpdate({
        target: [
          ContentTranslationRequest.contentId,
          ContentTranslationRequest.language,
        ],
        set: {
          sourceHash: sql`excluded.source_hash`,
          segments: sql`excluded.segments`,
          contentType: sql`excluded.content_type`,
          requestedAt: sql`now()`,
          availableAt: sql`now()`,
          attempts: 0,
          claimId: null,
        },
        // Polling must preserve a worker lease and a failed request's backoff.
        setWhere: sql`${ContentTranslationRequest.sourceHash} <> excluded.source_hash`,
      });
  }
  return results;
}

/** Claims one request without holding a DB connection while the model runs. */
export async function processNextTranslation(input: {
  translateBatch: TranslateBatch;
  modelVersion: string;
}): Promise<"idle" | "generated" | "superseded" | "retry"> {
  const request = await db.transaction(async (tx) => {
    const [pending] = await tx
      .select()
      .from(ContentTranslationRequest)
      .where(lte(ContentTranslationRequest.availableAt, sql`now()`))
      .orderBy(
        asc(ContentTranslationRequest.availableAt),
        asc(ContentTranslationRequest.requestedAt),
      )
      .limit(1)
      .for("update", { skipLocked: true });
    if (!pending) return null;
    const [claimed] = await tx
      .update(ContentTranslationRequest)
      .set({
        claimId: randomUUID(),
        attempts: pending.attempts + 1,
        availableAt: sql`now() + interval '15 minutes'`,
      })
      .where(eq(ContentTranslationRequest.id, pending.id))
      .returning();
    return claimed ?? null;
  });
  if (!request?.claimId) return "idle";
  const owned = and(
    eq(ContentTranslationRequest.id, request.id),
    eq(ContentTranslationRequest.claimId, request.claimId),
    eq(ContentTranslationRequest.sourceHash, request.sourceHash),
  );
  try {
    const language = z.enum(["es", "zh"]).parse(request.language);
    const payload = await translateSegments(
      request.segments,
      language,
      input.translateBatch,
    );
    const modelVersion = input.modelVersion
      .replace(
        `${TRANSLATION_PROMPT_VERSION}:`,
        `${translationPromptVersion(request.segments)}:`,
      )
      .slice(0, 80);
    return await db.transaction(async (tx) => {
      // A source revision or an expired lease must never publish stale work.
      const [current] = await tx
        .select({ id: ContentTranslationRequest.id })
        .from(ContentTranslationRequest)
        .where(owned)
        .for("update");
      if (!current) return "superseded" as const;
      await tx
        .insert(ContentTranslation)
        .values({
          contentId: request.contentId,
          contentType: request.contentType,
          language,
          sourceHash: request.sourceHash,
          payload,
          modelVersion,
        })
        .onConflictDoUpdate({
          target: [ContentTranslation.contentId, ContentTranslation.language],
          set: {
            sourceHash: request.sourceHash,
            payload,
            modelVersion,
          },
        });
      await tx.delete(ContentTranslationRequest).where(owned);
      return "generated" as const;
    });
  } catch (error) {
    const retryMinutes = Math.min(30, 2 ** Math.min(request.attempts, 5));
    await db
      .update(ContentTranslationRequest)
      .set({
        claimId: null,
        availableAt: sql`now() + ${retryMinutes} * interval '1 minute'`,
      })
      .where(owned);
    // Do not log provider errors: they can include source text or credentials.
    console.error(
      `[content-translation] ${request.contentId} ${request.language} failed (${error instanceof Error ? error.name : "unknown"}); retry in ${retryMinutes}m`,
    );
    return "retry";
  }
}
