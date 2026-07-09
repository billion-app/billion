/**
 * AI marketing content generation
 * Generates compelling social media titles, descriptions, and image prompts
 */

import { APICallError, generateObject, RetryError } from "ai";
import { z } from "zod";

import { trackLLMUsage } from "../costs.js";
import { createLogger } from "../log.js";
import { getTextLlm } from "./provider.js";
import {
  AIRateLimitError,
  rateLimitHit,
  setRateLimitHit,
} from "./text-generation.js";

function isRateLimitError(error: unknown): boolean {
  if (error instanceof APICallError) return error.statusCode === 429;
  if (error instanceof RetryError) return isRateLimitError(error.lastError);
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota")
  );
}

const logger = createLogger("ai");

// Video.title is varchar(100) in the DB. We don't enforce the limit in the
// generateObject schema because the model can overshoot, which makes the
// whole call throw and discards otherwise-usable copy. Instead we generate
// freely and truncate to fit the column below.
const TITLE_MAX_LENGTH = 100;

const MarketingCopySchema = z.object({
  title: z.string(),
  description: z.string(),
  imagePrompt: z.string(),
});

export type MarketingCopy = z.infer<typeof MarketingCopySchema>;

/**
 * Generate marketing copy for social media feed
 * @param articleTitle - Original article title
 * @param articleContent - Full article content
 * @param contentType - Type of content (bill, government_content, court_case)
 * @returns Marketing copy with title, description, and image prompt
 */
export async function generateMarketingCopy(
  articleTitle: string,
  articleContent: string,
  contentType: string,
): Promise<MarketingCopy> {
  if (rateLimitHit) {
    throw new AIRateLimitError();
  }
  try {
    logger.start(`Generating marketing copy for: ${articleTitle}`);

    const { object, usage } = await generateObject({
      model: getTextLlm(),
      schema: MarketingCopySchema,
      prompt: `You are a professional marketing copywriter creating engaging social media content.

Create compelling marketing copy for this ${contentType} to be displayed in a social media feed.

Requirements:
1. "title": Compelling, attention-grabbing title (MUST be 100 characters or less)
2. "description": A very short (max 25 words) summary for a mobile feed. Write in simple, plain English (8th-grade level). Focus on the "so what?"—why should a regular person care? No jargon.
3. "imagePrompt": A literal, photorealistic editorial scene that directly depicts the story. Make it information-dense within one coherent frame: include several relevant, recognizable details in the foreground, subject, and background so the image rewards closer viewing. Make it captivating, interesting, and fun with expressive human activity, an unusual but believable moment, a strong point of view, and energetic natural color. Use interesting perspectives such as an extreme close-up, wide environmental shot, or dramatic low angle when appropriate. Do not use metaphors, fantasy, dreamlike effects, surreal transformations, collages, infographics, or generic stock-photo staging. Avoid text, icons, logos, and watermarks.

Article Title: ${articleTitle}
Content Preview: ${articleContent.substring(0, 1000)}`,
    });
    trackLLMUsage(usage.inputTokens, usage.outputTokens);

    return {
      ...object,
      title: object.title.slice(0, TITLE_MAX_LENGTH).trim(),
    };
  } catch (error) {
    if (isRateLimitError(error)) {
      setRateLimitHit(true);
      throw new AIRateLimitError();
    }
    logger.error("Marketing copy generation failed", error);

    // Fallback to simple extraction
    return {
      title: articleTitle.substring(0, TITLE_MAX_LENGTH),
      description: articleContent.substring(0, 200) + "...",
      imagePrompt: `A dynamic, cinematic editorial photo about ${articleTitle}. Dramatic lighting, vivid colors.`,
    };
  }
}
