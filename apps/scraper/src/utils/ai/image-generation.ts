/**
 * AI image generation using Google Vertex AI Imagen 3
 * Generates images from text prompts and converts them to JPEG format
 */

import { generateImage as aiGenerateImage } from 'ai';
import { vertexProvider } from './provider.js';
import { createLogger } from '../log.js';
import { trackImagenImage } from '../costs.js';
import { AIRateLimitError, setRateLimitHit } from './text-generation.js';

const logger = createLogger("image");

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
 * Generate an image using Vertex AI Imagen 3 with retry logic for rate limits
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
        logger.start(`Generating image with Imagen 3: ${prompt.substring(0, 50)}...`);
      }

      const result = await aiGenerateImage({
        model: vertexProvider.image('imagen-3.0-generate-001'),
        prompt: `Professional news photography: ${prompt}. Photorealistic, high quality, journalistic style.`,
        aspectRatio: '1:1',
        providerOptions: {
          vertex: { sampleCount: 1 },
        },
      });

      // Imagen returns base64-encoded bytes directly — no URL download needed
      const buffer = Buffer.from(result.image.base64, 'base64');

      trackImagenImage();
      logger.success(`Image generated: ${buffer.length} bytes`);

      return {
        data: buffer,
        mimeType: result.image.mimeType ?? 'image/png',
        width: 1024,
        height: 1024,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Imagen safety filter block (don't retry)
      if (
        lastError.message.includes('SAFETY') ||
        lastError.message.includes('blocked') ||
        lastError.message.includes('content_filter')
      ) {
        logger.warn(`Image generation blocked by safety filter for prompt: ${prompt.substring(0, 100)}...`);
        return null;
      }

      // Check for rate limit errors (429 or RESOURCE_EXHAUSTED)
      const isRateLimitError =
        lastError.message.includes('RESOURCE_EXHAUSTED') ||
        lastError.message.includes('429') ||
        lastError.message.includes('rate_limit_exceeded') ||
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
        if (isRateLimitError) {
          setRateLimitHit(true);
          throw new AIRateLimitError();
        }
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
