/** Vercel serves cached translations and queues misses; big-mac owns generation. */
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";

import { and, asc, eq, lte, ne, sql } from "@acme/db";
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

export async function getSegmentTranslations(input: {
  contentId: string;
  contentType: "bill" | "government_content" | "court_case" | "measure";
  language: TranslationLanguage;
  segments: Segment[];
}): Promise<Record<string, string> | null> {
  const segments = input.segments;
  const sourceHash = hashSegments(segments);
  const [row] = await db
    .select()
    .from(ContentTranslation)
    .where(
      and(
        eq(ContentTranslation.contentId, input.contentId),
        eq(ContentTranslation.language, input.language),
      ),
    )
    .limit(1);
  // During a rolling deploy an old worker can claim a new API's request.
  // Its output must not masquerade as the current prompt merely because it
  // copied the request's source hash. A miss requeues it for the new worker.
  if (
    row?.sourceHash === sourceHash &&
    row.modelVersion.startsWith(`${TRANSLATION_PROMPT_VERSION}:`)
  ) {
    const parsed = payloadSchema.safeParse(row.payload);
    if (parsed.success) return parsed.data;
  }

  await db
    .insert(ContentTranslationRequest)
    .values({
      contentId: input.contentId,
      contentType: input.contentType,
      language: input.language,
      sourceHash,
      segments,
    })
    .onConflictDoUpdate({
      target: [
        ContentTranslationRequest.contentId,
        ContentTranslationRequest.language,
      ],
      set: {
        sourceHash,
        segments,
        contentType: input.contentType,
        requestedAt: sql`now()`,
        availableAt: sql`now()`,
        attempts: 0,
        claimId: null,
      },
      // Reader polling must not reset a lease or a failed request's backoff.
      setWhere: ne(ContentTranslationRequest.sourceHash, sourceHash),
    });
  return null;
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
          modelVersion: input.modelVersion,
        })
        .onConflictDoUpdate({
          target: [ContentTranslation.contentId, ContentTranslation.language],
          set: {
            sourceHash: request.sourceHash,
            payload,
            modelVersion: input.modelVersion,
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
