/**
 * Editorial image generation using selectable Codex OAuth or local FLUX;
 * the older shared article-image helper also retains hosted BFL fallback.
 */

import sharp from "sharp";

import { trackFluxImage } from "../costs.js";
import { createLogger } from "../log.js";
import { getResponsesConfig } from "./provider.js";
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
  width = 768,
  height = 768,
): Promise<GeneratedImage | null> {
  if (!LOCAL_FLUX_BASE_URL) return null;

  try {
    logger.start(
      `Generating image with local FLUX (${LOCAL_FLUX_MODEL}, ${width}x${height}): ${prompt.substring(0, 50)}...`,
    );
    const response = await fetch(`${LOCAL_FLUX_BASE_URL}/generate`, {
      method: "POST",
      headers: { accept: "image/*", "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        model: LOCAL_FLUX_MODEL,
        width,
        height,
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
      width,
      height,
    };
  } catch (error) {
    logger.error("Local FLUX fallback failed", error);
    return null;
  }
}

/**
 * Generate an image on the local FLUX server only, at an explicit size, with
 * the prompt passed through verbatim.
 *
 * `generateImage()` below is the wrong tool for anything that is not header
 * art: it wraps the prompt in an illustrated-editorial instruction and falls
 * back to the paid BFL API when the local server is unavailable. This one never
 * spends money and never editorialises the prompt, so callers own their own art
 * direction.
 */
export async function generateLocalPhoto(
  prompt: string,
  width: number,
  height: number,
): Promise<GeneratedImage | null> {
  return generateViaLocalFlux(prompt, width, height);
}

/** Header artwork uses subscription-backed GPT when selected, then local FLUX. */
export async function generateEditorialImage(
  prompt: string,
  width = 1024,
  height = 768,
): Promise<GeneratedImage | null> {
  if (process.env.SCRAPER_IMAGE_PROVIDER === "codex") {
    const config = getResponsesConfig();
    if (!config)
      throw new Error("SCRAPER_FALLBACK_BASE_URL is required for Codex images");
    const model = process.env.SCRAPER_IMAGE_MODEL?.trim() || "gpt-image-2";
    try {
      const response = await fetch(`${config.baseURL}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          size: width === height ? "1024x1024" : "1536x1024",
          quality: "low",
          n: 1,
        }),
        signal: AbortSignal.timeout(3 * 60 * 1000),
      });
      if (!response.ok) {
        const body = await response.text();
        try {
          const errorBody = JSON.parse(body) as { error?: { code?: string } };
          if (errorBody.error?.code === "content_policy_violation")
            throw new ContentModeratedError(
              "Codex image request was moderated",
            );
        } catch (error) {
          if (error instanceof ContentModeratedError) throw error;
        }
        throw new Error(
          `Codex image generation failed (${response.status}): ${body.slice(0, 500)}`,
        );
      }
      const result = (await response.json()) as {
        data?: Array<{ b64_json?: string }>;
        usage?: unknown;
      };
      const encoded = result.data?.[0]?.b64_json;
      if (!encoded) throw new Error("Codex image response has no base64 image");
      const data = Buffer.from(encoded, "base64");
      const metadata = await sharp(data).metadata();
      if (
        !metadata.width ||
        !metadata.height ||
        !["png", "jpeg", "webp"].includes(metadata.format ?? "")
      )
        throw new Error("Codex image response is not a supported raster image");
      logger.success(
        `Codex image generated (${model}): ${metadata.width}x${metadata.height}, ${data.length} bytes`,
      );
      logger.info(`Codex image usage: ${JSON.stringify(result.usage ?? {})}`);
      return {
        data,
        mimeType: `image/${metadata.format}`,
        width: metadata.width,
        height: metadata.height,
      };
    } catch (error) {
      if (error instanceof ContentModeratedError) {
        logger.warn(error.message);
        return null;
      }
      logger.warn("Codex image generation failed; trying local FLUX", error);
    }
  }
  return generateViaLocalFlux(prompt, width, height);
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
  const fullPrompt = `Grounded editorial documentary image about this civic issue: ${prompt}. Show a plausible real-world scene with one clear subject, natural light, restrained color, accurate objects and architecture, and a calm photojournalistic composition. Keep people anatomically realistic and the setting specific to the issue. Avoid fantasy, surreal metaphors, floating objects, exaggerated scale, glowing effects, generic handshakes, glossy advertising, and staged corporate meeting rooms. No readable text, captions, labels, logos, UI, or watermark.`;

  // Local-first: the local FLUX server is free, so it gets the first attempt and
  // the paid BFL API is the fallback for when it is down or unconfigured.
  const preferredImage = await generateEditorialImage(fullPrompt, 768, 768);
  if (preferredImage) return preferredImage;

  if (!BFL_API_KEY) {
    if (!LOCAL_FLUX_BASE_URL) {
      logger.error(
        "BFL_API_KEY and LOCAL_FLUX_BASE_URL are not set — cannot generate images",
      );
    }
    return null;
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
        return null;
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
