/**
 * AI image generation using BFL-hosted FLUX with a local FLUX HTTP fallback.
 */

import { trackFluxImage } from "../costs.js";
import { createLogger } from "../log.js";
import { AIRateLimitError, setRateLimitHit } from "./text-generation.js";

const logger = createLogger("image");

const BFL_API_KEY = process.env.BFL_API_KEY;
// Klein 9B is the cost-efficient default for high-volume feed imagery.
const BFL_MODEL = process.env.BFL_MODEL || "flux-2-klein-9b";
const BFL_BASE_URL = "https://api.bfl.ai/v1";
const LOCAL_FLUX_BASE_URL = process.env.LOCAL_FLUX_BASE_URL?.trim().replace(
  /\/$/,
  "",
);
const LOCAL_FLUX_MODEL = process.env.LOCAL_FLUX_MODEL?.trim() || "klein";

// Signed result URLs are valid for 10 minutes, so cap polling well within that.
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
  width: number;
  height: number;
}

interface BflSubmitResponse {
  id: string;
  polling_url: string;
}

interface BflPollResponse {
  status: string;
  result?: { sample?: string };
}

/**
 * Sleep for a specified number of milliseconds
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Marker error so the retry loop can distinguish a content-moderation block
 * (don't retry, return null) from a real failure.
 */
class ContentModeratedError extends Error {}

/**
 * Submit a generation request and poll the result URL until the image is ready.
 * @returns the signed sample URL for the generated image
 * @throws ContentModeratedError if the prompt or result is moderated
 */
async function generateViaFlux(prompt: string): Promise<string> {
  const submit = await fetch(`${BFL_BASE_URL}/${BFL_MODEL}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "x-key": BFL_API_KEY as string,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, width: 1024, height: 1024 }),
  });

  if (!submit.ok) {
    const text = await submit.text();
    throw new Error(`BFL submit failed (${submit.status}): ${text}`);
  }

  const { polling_url } = (await submit.json()) as BflSubmitResponse;
  if (!polling_url) {
    throw new Error("BFL submit response missing polling_url");
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const poll = await fetch(polling_url, {
      headers: { accept: "application/json", "x-key": BFL_API_KEY as string },
    });

    if (!poll.ok) {
      const text = await poll.text();
      throw new Error(`BFL poll failed (${poll.status}): ${text}`);
    }

    const data = (await poll.json()) as BflPollResponse;
    switch (data.status) {
      case "Ready": {
        const sample = data.result?.sample;
        if (!sample) {
          throw new Error("BFL result Ready but missing sample URL");
        }
        return sample;
      }
      case "Content Moderated":
      case "Request Moderated":
        throw new ContentModeratedError(data.status);
      case "Error":
      case "Failed":
        throw new Error(`BFL generation failed: ${JSON.stringify(data)}`);
      // 'Pending'/'Processing' — keep polling
    }
  }

  throw new Error(`BFL generation timed out after ${POLL_TIMEOUT_MS}ms`);
}

async function generateViaLocalFlux(
  prompt: string,
): Promise<GeneratedImage | null> {
  if (!LOCAL_FLUX_BASE_URL) return null;

  try {
    logger.start(
      `Generating image with local FLUX (${LOCAL_FLUX_MODEL}): ${prompt.substring(0, 50)}...`,
    );
    const response = await fetch(`${LOCAL_FLUX_BASE_URL}/generate`, {
      method: "POST",
      headers: { accept: "image/*", "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        model: LOCAL_FLUX_MODEL,
        width: 768,
        height: 768,
      }),
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });
    if (!response.ok) {
      throw new Error(
        `Local FLUX failed (${response.status}): ${(await response.text()).slice(0, 500)}`,
      );
    }

    const data = Buffer.from(await response.arrayBuffer());
    logger.success(`Local FLUX image generated: ${data.length} bytes`);
    return {
      data,
      mimeType: response.headers.get("content-type") ?? "image/png",
      width: 768,
      height: 768,
    };
  } catch (error) {
    logger.error("Local FLUX fallback failed", error);
    return null;
  }
}

/**
 * Generate an image using FLUX.2 Klein 9B with retry logic for rate limits
 * @param prompt - Text description of desired image
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Generated image as Buffer with metadata, or null if generation fails
 */
export async function generateImage(
  prompt: string,
  maxRetries = 3,
): Promise<GeneratedImage | null> {
  const fullPrompt = `Imaginative editorial illustration with the playful, information-dense, slightly surreal character of early generative artwork: ${prompt}. Build one memorable composition with a strong focal point and multiple story-specific details across foreground, subject, and background. Use bold color, expressive characters, visual metaphor, symbolic scale, witty or uncanny juxtapositions, and tactile illustrated texture where useful. The image should reveal more on a second look while still clearly communicating the real civic issue. Avoid corporate stock photography, sterile meeting-room staging, generic handshakes, glossy ad aesthetics, and photorealistic paperwork. No readable text, captions, labels, logos, UI, or watermark.`;

  if (!BFL_API_KEY) {
    const localImage = await generateViaLocalFlux(fullPrompt);
    if (!localImage && !LOCAL_FLUX_BASE_URL) {
      logger.error(
        "BFL_API_KEY and LOCAL_FLUX_BASE_URL are not set — cannot generate images",
      );
    }
    return localImage;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.warn(
          `Retry attempt ${attempt}/${maxRetries} for image generation`,
        );
      } else {
        logger.start(
          `Generating image with FLUX.2 Klein 9B: ${prompt.substring(0, 50)}...`,
        );
      }

      const sampleUrl = await generateViaFlux(fullPrompt);

      // The sample URL is a short-lived signed link — download the bytes now.
      const imageRes = await fetch(sampleUrl);
      if (!imageRes.ok) {
        throw new Error(
          `Failed to download generated image (${imageRes.status})`,
        );
      }
      const buffer = Buffer.from(await imageRes.arrayBuffer());

      trackFluxImage();
      logger.success(`Image generated: ${buffer.length} bytes`);

      return {
        data: buffer,
        mimeType: imageRes.headers.get("content-type") ?? "image/png",
        width: 1024,
        height: 1024,
      };
    } catch (error) {
      // Content moderation block (don't retry)
      if (error instanceof ContentModeratedError) {
        logger.warn(
          `Image generation blocked by content moderation for prompt: ${prompt.substring(0, 100)}...`,
        );
        return null;
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      // Check for rate limit errors (BFL returns 429 when out of concurrency/credits)
      const isRateLimitError =
        lastError.message.includes("429") ||
        lastError.message.includes("rate_limit_exceeded") ||
        lastError.message.includes("Rate limit") ||
        lastError.message.includes("Too Many Requests");

      if (isRateLimitError && attempt < maxRetries) {
        // Exponential backoff: 2^attempt * 1000ms (1s, 2s, 4s, 8s...)
        const delayMs = Math.pow(2, attempt) * 1000;
        logger.warn(
          `Rate limit hit, waiting ${delayMs}ms before retry (attempt ${attempt + 1}/${maxRetries})...`,
        );
        await sleep(delayMs);
        continue;
      }

      // If it's the last attempt or not a rate limit error, break
      if (attempt === maxRetries) {
        const localImage = await generateViaLocalFlux(fullPrompt);
        if (localImage) return localImage;
        if (isRateLimitError) {
          setRateLimitHit(true);
          throw new AIRateLimitError();
        }
        logger.error(
          `Image generation failed after ${maxRetries} retries`,
          lastError,
        );
        return null;
      }

      // For other errors, don't retry
      if (!isRateLimitError) {
        logger.error("Image generation failed", lastError);
        return generateViaLocalFlux(fullPrompt);
      }
    }
  }

  // Should not reach here, but handle it gracefully
  logger.error("Image generation failed", lastError);
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
    const sharp = (await import("sharp")).default;

    const jpegBuffer = await sharp(pngBuffer).jpeg({ quality }).toBuffer();

    logger.debug(
      `Converted PNG to JPEG: ${pngBuffer.length} -> ${jpegBuffer.length} bytes`,
    );

    return jpegBuffer;
  } catch (error) {
    logger.error("JPEG conversion failed", error);
    // Return original buffer if conversion fails
    return pngBuffer;
  }
}
