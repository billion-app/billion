/**
 * AI image generation using OpenAI DALL-E
 * Generates images from text prompts and converts them to JPEG format
 */

import OpenAI from 'openai';
import { createLogger } from '../log.js';
import { trackDalle3Image } from '../costs.js';

const logger = createLogger("image");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
  width: number;
  height: number;
}

/**
 * Sleep for a specified number of milliseconds
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate an image using DALL-E 3 with retry logic for rate limits
 * @param prompt - Text description of desired image
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Generated image as Buffer with metadata, or null if generation fails
 */
export async function generateImage(
  prompt: string,
  maxRetries = 3,
): Promise<GeneratedImage | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.warn(`Retry attempt ${attempt}/${maxRetries} for image generation`);
      } else {
        logger.start(`Generating image with DALL-E 3: ${prompt.substring(0, 50)}...`);
      }

      // DALL-E 3 for quality
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: `Professional news photography: ${prompt}. Photorealistic, high quality, journalistic style.`,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'url',
      });

      if (!response.data?.[0]?.url) {
        logger.error('No image URL returned from DALL-E');
        return null;
      }

      const imageUrl = response.data[0].url;

      // Download image to buffer (URLs expire after 1 hour, need to store permanently)
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        logger.error(`Failed to download image: ${imageResponse.status}`);
        return null;
      }

      const buffer = Buffer.from(await imageResponse.arrayBuffer());

      trackDalle3Image();
      logger.success(`Image generated: ${buffer.length} bytes`);

      return {
        data: buffer,
        mimeType: 'image/png', // DALL-E returns PNG
        width: 1024,
        height: 1024,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is due to content policy violation (don't retry)
      if (lastError.message.includes('content_policy_violation')) {
        logger.warn(`Image generation blocked by content filter for prompt: ${prompt.substring(0, 100)}...`);
        return null;
      }

      // Check for rate limit errors (429 or rate_limit_exceeded)
      const isRateLimitError =
        lastError.message.includes('rate_limit_exceeded') ||
        lastError.message.includes('429') ||
        lastError.message.includes('Rate limit');

      if (isRateLimitError && attempt < maxRetries) {
        // Exponential backoff: 2^attempt * 1000ms (1s, 2s, 4s, 8s...)
        const delayMs = Math.pow(2, attempt) * 1000;
        logger.warn(`Rate limit hit, waiting ${delayMs}ms before retry (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(delayMs);
        continue;
      }

      // If it's the last attempt or not a rate limit error, break
      if (attempt === maxRetries) {
        logger.error(`Image generation failed after ${maxRetries} retries`, lastError);
        return null;
      }

      // For other errors, don't retry
      if (!isRateLimitError) {
        logger.error('Image generation failed', lastError);
        return null;
      }
    }
  }

  // Should not reach here, but handle it gracefully
  logger.error('Image generation failed', lastError);
  return null;
}

/**
 * Convert PNG buffer to JPEG format for smaller file size
 * @param pngBuffer - PNG image buffer
 * @param quality - JPEG quality (0-100), default 85
 * @returns JPEG buffer
 */
export async function convertToJpeg(
  pngBuffer: Buffer,
  quality = 85,
): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default;

    const jpegBuffer = await sharp(pngBuffer)
      .jpeg({ quality })
      .toBuffer();

    logger.debug(`Converted PNG to JPEG: ${pngBuffer.length} -> ${jpegBuffer.length} bytes`);

    return jpegBuffer;
  } catch (error) {
    logger.error('JPEG conversion failed', error);
    // Return original buffer if conversion fails
    return pngBuffer;
  }
}
