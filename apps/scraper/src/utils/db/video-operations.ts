/**
 * Database operations for generating and upserting video content
 * Handles AI-generated marketing copy and images for the feed
 */

import { and, eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { Video } from "@acme/db/schema";

import { convertToJpeg, generateImage } from "../ai/image-generation.js";
import { generateMarketingCopy } from "../ai/marketing-generation.js";
import { createLogger } from "../log.js";
import {
  removeGeneratedContentImages,
  uploadGeneratedContentImage,
} from "../storage/content-images.js";
import { incrementVideosGenerated, incrementVideosSkipped } from "./metrics.js";

const logger = createLogger("video");

/**
 * Check if a video entry exists and needs regeneration
 */
async function checkExistingVideo(
  contentType: string,
  contentId: string,
  currentContentHash: string,
): Promise<{
  exists: boolean;
  needsRegeneration: boolean;
  hasImage: boolean;
  generatedImagePath: string | null;
} | null> {
  const [existing] = await db
    .select({
      sourceContentHash: Video.sourceContentHash,
      generatedImagePath: Video.generatedImagePath,
      hasLegacyImage: sql<boolean>`${Video.imageData} is not null`,
      thumbnailUrl: Video.thumbnailUrl,
    })
    .from(Video)
    .where(
      and(eq(Video.contentType, contentType), eq(Video.contentId, contentId)),
    )
    .limit(1);

  if (!existing) return null;

  // Record needs regeneration if content hash changed OR if it's missing image data entirely
  // (neither AI generated nor a scraped fallback)
  const isMissingImage =
    !existing.generatedImagePath &&
    !existing.hasLegacyImage &&
    !existing.thumbnailUrl;
  const needsRegeneration =
    existing.sourceContentHash !== currentContentHash || isMissingImage;

  return {
    exists: true,
    needsRegeneration,
    hasImage: !isMissingImage,
    generatedImagePath: existing.generatedImagePath,
  };
}

export interface GenerateVideoOptions {
  force?: boolean;
  /** Generate a fresh image prompt without changing existing feed copy. */
  preserveCopy?: boolean;
}

export interface GenerateVideoResult {
  regenerated: boolean;
  hasImage: boolean;
}

/**
 * A video row's worth of content, produced without touching the database.
 *
 * Header art is the slowest asset to generate and the most visible when it is
 * missing — a grey placeholder occupying the top third of the detail screen.
 * Separating "make it" from "store it" lets a caller finish every asset before
 * any row exists, so a bill is never briefly visible without its art.
 */
export interface BuiltVideoRecord {
  title: string;
  description: string;
  imageData: Buffer | null;
  imageMimeType: string | null;
  thumbnailUrl: string | null;
  author: string;
  engagementMetrics: { likes: number; comments: number; shares: number };
  sourceContentHash: string;
}

/**
 * Anything that can run an insert — the pool, or a transaction handle.
 * Structural so a caller can pass `db` or a `tx` without this module needing to
 * know which.
 */
export type DbExecutor = Pick<typeof db, "insert">;

/**
 * Generate marketing copy and header art in memory.
 *
 * Returns `null` only when copy generation fails outright; a missing image is
 * represented by `imageData: null` rather than a failure, because a scraped
 * `thumbnailUrl` is an acceptable substitute and the caller decides whether
 * that is good enough.
 */
export async function buildVideoRecord(
  contentType: "bill" | "government_content" | "court_case",
  title: string,
  fullText: string,
  contentHash: string,
  author: string,
  thumbnailUrl?: string | null,
  hasExistingImage = false,
): Promise<BuiltVideoRecord | null> {
  const marketingCopy = await generateMarketingCopy(
    title,
    fullText,
    contentType,
  );
  if (!marketingCopy) return null;

  let imageData: Buffer | null = null;
  let imageMimeType: string | null = null;
  let generatedImage = await generateImage(marketingCopy.imagePrompt);

  if (!generatedImage && !thumbnailUrl && !hasExistingImage) {
    const safeFallbackPrompt =
      contentType === "court_case"
        ? "A richly illustrated civic tableau: a monumental courthouse transformed into a balancing scale, with expressive citizens, legal folders, and story clues arranged across the steps in a bold, slightly surreal composition."
        : contentType === "bill"
          ? "A richly illustrated civic machine built around the United States Capitol, with gears, expressive citizens, symbolic objects, and layered policy clues in a colorful, witty, slightly surreal composition."
          : "A richly illustrated civic tableau where a government building opens into a miniature world of expressive people and story-specific public-life details, colorful, layered, witty, and slightly surreal.";
    logger.warn(
      `Primary image unavailable for ${contentType}; trying an illustrated fallback`,
    );
    generatedImage = await generateImage(safeFallbackPrompt);
  }

  if (generatedImage) {
    imageData = await convertToJpeg(generatedImage.data);
    imageMimeType = "image/jpeg";
  }

  return {
    // Hard-truncate to the DB constraint (varchar 100) as a safety net in case
    // the AI schema validation ever drifts from the DB schema again.
    title: marketingCopy.title.substring(0, 100),
    description: marketingCopy.description,
    imageData,
    imageMimeType,
    thumbnailUrl: thumbnailUrl ?? null,
    author,
    engagementMetrics: {
      likes: Math.floor(Math.random() * 50000) + 1000,
      comments: Math.floor(Math.random() * 2000) + 50,
      shares: Math.floor(Math.random() * 1000) + 10,
    },
    sourceContentHash: contentHash,
  };
}

/**
 * Write a previously built video record. Takes an executor so it can run inside
 * the same transaction as the content row it belongs to.
 */
export async function persistVideoRecord(
  executor: DbExecutor,
  contentType: "bill" | "government_content" | "court_case",
  contentId: string,
  record: BuiltVideoRecord,
  options: { preserveCopy?: boolean } = {},
): Promise<string | null> {
  const storedImage = record.imageData
    ? await uploadGeneratedContentImage({
        contentType,
        contentId,
        imageData: record.imageData,
      })
    : null;

  // Never erase a working image when a replacement provider fails.
  const replacementImage = storedImage
    ? {
        imageData: null,
        imageMimeType: record.imageMimeType,
        imageWidth: 1024,
        imageHeight: 1024,
        generatedImagePath: storedImage.path,
        generatedImageHash: storedImage.hash,
        imageStorageVerifiedAt: storedImage.verifiedAt,
        imageStorageError: null,
        imageStorageAttempts: sql`coalesce(${Video.imageStorageAttempts}, 0) + 1`,
      }
    : record.thumbnailUrl
      ? { thumbnailUrl: record.thumbnailUrl }
      : {};

  await executor
    .insert(Video)
    .values({
      contentType,
      contentId,
      title: record.title,
      description: record.description,
      imageData: null,
      imageMimeType: record.imageMimeType,
      imageWidth: record.imageData ? 1024 : null,
      imageHeight: record.imageData ? 1024 : null,
      generatedImagePath: storedImage?.path,
      generatedImageHash: storedImage?.hash,
      imageStorageVerifiedAt: storedImage?.verifiedAt,
      imageStorageAttempts: storedImage ? 1 : 0,
      thumbnailUrl: record.thumbnailUrl ?? undefined,
      author: record.author,
      engagementMetrics: record.engagementMetrics,
      sourceContentHash: record.sourceContentHash,
    })
    .onConflictDoUpdate({
      target: [Video.contentType, Video.contentId],
      set: {
        ...(!options.preserveCopy && {
          title: record.title,
          description: record.description,
        }),
        ...replacementImage,
        sourceContentHash: record.sourceContentHash,
        updatedAt: new Date(),
      },
    });

  return storedImage?.path ?? null;
}

/**
 * Generate or update video content for a source item
 * @param contentType - Type of content (bill, government_content, court_case)
 * @param contentId - UUID of the source content
 * @param title - Original content title
 * @param fullText - Full text content for AI generation
 * @param contentHash - Hash of source content for cache invalidation
 * @param author - Author/source of the content
 * @param thumbnailUrl - Optional thumbnail URL from source content (for hybrid support)
 */
export async function generateVideoForContent(
  contentType: "bill" | "government_content" | "court_case",
  contentId: string,
  title: string,
  fullText: string,
  contentHash: string,
  author: string,
  thumbnailUrl?: string | null,
  options: GenerateVideoOptions = {},
  claimBudget?: () => boolean,
): Promise<GenerateVideoResult> {
  const existing = await checkExistingVideo(
    contentType,
    contentId,
    contentHash,
  );

  // Skip if exists and unchanged
  if (existing && !existing.needsRegeneration && !options.force) {
    logger.debug(`Video unchanged for ${contentType}:${contentId}, skipping`);
    incrementVideosSkipped();
    return { regenerated: false, hasImage: existing.hasImage };
  }

  // Claimed only past the cache check, so an unchanged video never spends a
  // slot. Regeneration costs a marketing-copy call plus an image, which is why
  // it belongs under the same per-run budget as the brief and the lens.
  if (claimBudget && !claimBudget()) {
    logger.info(
      `Run budget reached, deferring video for ${contentType}:${contentId} to a later run`,
    );
    incrementVideosSkipped();
    return { regenerated: false, hasImage: existing?.hasImage ?? false };
  }

  logger.start(`Generating video for ${contentType}:${contentId}`);

  const record = await buildVideoRecord(
    contentType,
    title,
    fullText,
    contentHash,
    author,
    thumbnailUrl,
    existing?.hasImage ?? false,
  );

  if (!record) {
    logger.warn(`Marketing copy unavailable for ${contentType}:${contentId}`);
    incrementVideosSkipped();
    return { regenerated: false, hasImage: existing?.hasImage ?? false };
  }

  try {
    const storedPath = await persistVideoRecord(
      db,
      contentType,
      contentId,
      record,
      options,
    );
    if (
      storedPath &&
      existing?.generatedImagePath &&
      existing.generatedImagePath !== storedPath
    ) {
      try {
        await removeGeneratedContentImages([existing.generatedImagePath]);
      } catch (cleanupError) {
        // The new version is already durable. Cleanup is retryable operational
        // work and must not make a successful regeneration look failed.
        logger.warn(
          `Stored ${storedPath}, but could not remove superseded ${existing.generatedImagePath}: ${
            cleanupError instanceof Error ? cleanupError.message : cleanupError
          }`,
        );
      }
    }

    incrementVideosGenerated();
    logger.success(`Video generated for ${contentType}:${contentId}`);
    return {
      regenerated: true,
      hasImage: Boolean(
        record.imageData || record.thumbnailUrl || existing?.hasImage,
      ),
    };
  } catch (error) {
    // Build a sanitized error message — the raw DB error embeds binary image
    // data as SQL parameter values which floods logs with unicode gibberish
    const rawMessage = error instanceof Error ? error.message : String(error);
    const sanitizedMessage = rawMessage
      // Remove the full query dump (contains binary data as parameter values)
      .replace(
        /Failed query:[\s\S]*/i,
        "Failed query: <redacted — contains binary image data>",
      )
      // Belt-and-suspenders: also strip any remaining base64/binary blobs
      .replace(/\\x[0-9a-fA-F]{20,}/g, "<binary blob>");
    logger.error(
      `Failed to upsert video for ${contentType}:${contentId}: ${sanitizedMessage}`,
    );
    // Throw a clean error so callers don't re-log the raw binary payload
    throw new Error(
      `Video upsert failed for ${contentType}:${contentId}: ${sanitizedMessage}`,
    );
  }
}
