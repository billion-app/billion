/**
 * Database operations for generating and upserting video content
 * Handles AI-generated marketing copy and images for the feed
 */

import { db } from '@acme/db/client';
import { Video } from '@acme/db/schema';
import { uploadImage, deleteImage } from '@acme/db/storage';
import { and, eq } from '@acme/db';
import { generateMarketingCopy } from '../ai/marketing-generation.js';
import { generateImage, convertToJpeg } from '../ai/image-generation.js';
import { incrementVideosGenerated, incrementVideosSkipped } from './metrics.js';
import { createLogger } from '../log.js';

const logger = createLogger("video");

/**
 * Check if a video entry exists and needs regeneration
 */
async function checkExistingVideo(
  contentType: string,
  contentId: string,
  currentContentHash: string,
): Promise<{ exists: boolean; needsRegeneration: boolean } | null> {
  const [existing] = await db
    .select({ sourceContentHash: Video.sourceContentHash })
    .from(Video)
    .where(and(eq(Video.contentType, contentType), eq(Video.contentId, contentId)))
    .limit(1);

  if (!existing) return null;

  return {
    exists: true,
    needsRegeneration: existing.sourceContentHash !== currentContentHash,
  };
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
  contentType: 'bill' | 'government_content' | 'court_case',
  contentId: string,
  title: string,
  fullText: string,
  contentHash: string,
  author: string,
  thumbnailUrl?: string | null,
): Promise<void> {
  const existing = await checkExistingVideo(contentType, contentId, contentHash);

  // Skip if exists and unchanged
  if (existing && !existing.needsRegeneration) {
    logger.debug(`Video unchanged for ${contentType}:${contentId}, skipping`);
    incrementVideosSkipped();
    return;
  }

  logger.start(`Generating video for ${contentType}:${contentId}`);

  // Generate marketing copy
  const marketingCopy = await generateMarketingCopy(title, fullText, contentType);

  // Generate and convert image (upload happens after DB write to avoid orphans)
  let jpegData: Buffer | null = null;
  const generatedImage = await generateImage(marketingCopy.imagePrompt);
  if (generatedImage) {
    jpegData = await convertToJpeg(generatedImage.data);
  }

  // Random engagement metrics (same as current video.ts)
  const engagementMetrics = {
    likes: Math.floor(Math.random() * 50000) + 1000,
    comments: Math.floor(Math.random() * 2000) + 50,
    shares: Math.floor(Math.random() * 1000) + 10,
  };

  // Upsert video first (without image URL)
  try {
    await db
      .insert(Video)
      .values({
        contentType,
        contentId,
        title: marketingCopy.title,
        description: marketingCopy.description,
        thumbnailUrl: thumbnailUrl ?? undefined,
        author,
        engagementMetrics,
        sourceContentHash: contentHash,
      })
      .onConflictDoUpdate({
        target: [Video.contentType, Video.contentId],
        set: {
          title: marketingCopy.title,
          description: marketingCopy.description,
          thumbnailUrl: thumbnailUrl ?? undefined,
          sourceContentHash: contentHash,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    // Sanitize error to avoid logging raw image data
    const sanitizedError = error instanceof Error
      ? `${error.name}: ${error.message.replace(/image_data[^,]*,/g, 'image_data=<REDACTED>,')}`
      : 'Unknown database error';
    logger.error(`Failed to insert video for ${contentType}:${contentId}: ${sanitizedError}`);
    throw error;
  }

  // Upload image after successful DB write, then update the row
  if (jpegData) {
    const storagePath = `videos/${contentType}/${contentId}.jpg`;
    let imageUrl: string | undefined;
    try {
      imageUrl = await uploadImage(storagePath, jpegData);
    } catch (error) {
      logger.warn(`Image upload failed for ${contentType}:${contentId}, video saved without image`);
    }
    if (imageUrl) {
      try {
        await db
          .update(Video)
          .set({ imageUrl })
          .where(and(eq(Video.contentType, contentType), eq(Video.contentId, contentId)));
        logger.debug(`Uploaded image to ${storagePath}`);
      } catch (error) {
        // Don't delete the uploaded file — it lives at a deterministic path that
        // may already be referenced by a previous imageUrl, and will be
        // overwritten on the next successful run.
        logger.warn(`DB update for imageUrl failed for ${contentType}:${contentId}, image uploaded but URL not saved`);
      }
    }
  }

  incrementVideosGenerated();
  logger.success(`Video generated for ${contentType}:${contentId}`);
}
