/**
 * Database operations for generating and upserting video content
 * Handles AI-generated marketing copy and images for the feed
 */

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { Video } from "@acme/db/schema";

import { convertToJpeg, generateImage } from "../ai/image-generation.js";
import { generateMarketingCopy } from "../ai/marketing-generation.js";
import { createLogger } from "../log.js";
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
} | null> {
  const [existing] = await db
    .select({
      sourceContentHash: Video.sourceContentHash,
      imageData: Video.imageData,
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
  const isMissingImage = !existing.imageData && !existing.thumbnailUrl;
  const needsRegeneration =
    existing.sourceContentHash !== currentContentHash || isMissingImage;

  return {
    exists: true,
    needsRegeneration,
    hasImage: !isMissingImage,
  };
}

export interface GenerateVideoOptions {
  force?: boolean;
}

export interface GenerateVideoResult {
  regenerated: boolean;
  hasImage: boolean;
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

  logger.start(`Generating video for ${contentType}:${contentId}`);

  // Generate marketing copy
  const marketingCopy = await generateMarketingCopy(
    title,
    fullText,
    contentType,
  );

  // Generate and convert image
  let imageData: Buffer | null = null;
  let imageMimeType: string | null = null;
  let generatedImage = await generateImage(marketingCopy.imagePrompt);
  if (!generatedImage && !thumbnailUrl && !existing?.hasImage) {
    const safeFallbackPrompt =
      contentType === "court_case"
        ? "A neutral photorealistic editorial photograph of a stately American courthouse exterior at golden hour, with stone columns, broad steps, legal folders on a foreground bench, no people, no text, no logos, no watermark."
        : contentType === "bill"
          ? "A neutral photorealistic editorial photograph of the United States Capitol exterior at golden hour, with legislative papers and reading glasses on a foreground desk, no people, no text, no logos, no watermark."
          : "A neutral photorealistic editorial photograph of a federal government building and press lectern at golden hour, no people, no text, no logos, no watermark.";
    logger.warn(
      `Primary image unavailable for ${contentType}:${contentId}; trying a neutral fallback`,
    );
    generatedImage = await generateImage(safeFallbackPrompt);
  }
  if (generatedImage) {
    imageData = await convertToJpeg(generatedImage.data);
    imageMimeType = "image/jpeg";
  }

  // Random engagement metrics (same as current video.ts)
  const engagementMetrics = {
    likes: Math.floor(Math.random() * 50000) + 1000,
    comments: Math.floor(Math.random() * 2000) + 50,
    shares: Math.floor(Math.random() * 1000) + 10,
  };

  // Upsert video with hybrid image support
  // Hard-truncate title to DB constraint (varchar 100) as a safety net in case
  // the AI schema validation ever drifts from the DB schema again
  const safeTitle = marketingCopy.title.substring(0, 100);

  try {
    const replacementImage = imageData
      ? {
          imageData,
          imageMimeType,
          imageWidth: 1024,
          imageHeight: 1024,
        }
      : thumbnailUrl
        ? { thumbnailUrl }
        : {};

    await db
      .insert(Video)
      .values({
        contentType,
        contentId,
        title: safeTitle,
        description: marketingCopy.description,
        imageData,
        imageMimeType,
        imageWidth: imageData ? 1024 : null,
        imageHeight: imageData ? 1024 : null,
        thumbnailUrl: thumbnailUrl ?? undefined, // Add URL-based thumbnail support
        author,
        engagementMetrics,
        sourceContentHash: contentHash,
      })
      .onConflictDoUpdate({
        target: [Video.contentType, Video.contentId],
        set: {
          title: safeTitle,
          description: marketingCopy.description,
          // Never erase a working image when a replacement provider fails.
          ...replacementImage,
          sourceContentHash: contentHash,
          updatedAt: new Date(),
        },
      });

    incrementVideosGenerated();
    logger.success(`Video generated for ${contentType}:${contentId}`);
    return {
      regenerated: true,
      hasImage: Boolean(imageData || thumbnailUrl || existing?.hasImage),
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
