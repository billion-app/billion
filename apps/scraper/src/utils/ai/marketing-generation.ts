/**
 * AI marketing content generation using Google Vertex AI
 * Generates compelling social media titles, descriptions, and image prompts
 */

import { generateObject, APICallError, RetryError } from "ai";
import { z } from "zod";
import { createLogger } from "../log.js";
import { trackGeminiUsage } from "../costs.js";
import { AIRateLimitError, rateLimitHit, setRateLimitHit } from "./text-generation.js";
import { vertexProvider } from "./provider.js";

function isRateLimitError(error: unknown): boolean {
  if (error instanceof APICallError) return error.statusCode === 429;
  if (error instanceof RetryError) return isRateLimitError(error.lastError);
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('resource_exhausted') || msg.includes('quota');
}

const logger = createLogger("ai");

const MarketingCopySchema = z.object({
  title: z.string().max(25), // Must match Video.title varchar(25) DB constraint
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
      model: vertexProvider("gemini-2.5-flash"),
      schema: MarketingCopySchema,
      prompt: `You are a professional marketing copywriter creating engaging social media content.

Create compelling marketing copy for this ${contentType} to be displayed in a social media feed.

Requirements:
1. "title": Compelling, attention-grabbing title (MUST be 25 characters or less)
2. "description": A very short (max 25 words) summary for a mobile feed. Write in simple, plain English (8th-grade level). Focus on the "so what?"—why should a regular person care? No jargon.
3. "imagePrompt": A creative, high-energy, and visually arresting scene description that captures the *essence* of the story. Instead of literal office buildings or meetings, focus on dramatic metaphors, intense human emotion, or dynamic action. Use vivid color descriptions and interesting perspectives (e.g., extreme close-ups, wide cinematic shots, or dramatic low angles). Avoid text, icons, or stereotypical stock photo tropes.

Article Title: ${articleTitle}
Content Preview: ${articleContent.substring(0, 1000)}`,
    });
    trackGeminiUsage(usage.inputTokens, usage.outputTokens);

    return object;
  } catch (error) {
    if (isRateLimitError(error)) {
      setRateLimitHit(true);
      throw new AIRateLimitError();
    }
    logger.error("Marketing copy generation failed", error);

    // Fallback to simple extraction
    return {
      title: articleTitle.substring(0, 25),
      description: articleContent.substring(0, 200) + "...",
      imagePrompt: `A dynamic, cinematic editorial photo about ${articleTitle}. Dramatic lighting, vivid colors.`,
    };
  }
}
