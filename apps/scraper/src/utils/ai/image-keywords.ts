/**
 * AI-powered image keyword generation
 * Uses OpenAI to extract visual concepts for image search
 */

import { google } from '@ai-sdk/google';
import { generateText, APICallError, RetryError } from 'ai';

import { AIRateLimitError, rateLimitHit, setRateLimitHit } from './text-generation.js';

function isRateLimitError(error: unknown): boolean {
  if (error instanceof APICallError) return error.statusCode === 429;
  if (error instanceof RetryError) return isRateLimitError(error.lastError);

  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota')
  );
}

/**
 * Generate search keywords from article title and content
 * Uses AI to extract the most relevant visual concepts
 * @param title - Article title
 * @param content - Article content
 * @param type - Content type (bill, order, case, etc.)
 * @returns Search query string
 */
export async function generateImageSearchKeywords(
  title: string,
  content: string,
  type: string,
): Promise<string> {
  if (rateLimitHit) {
    throw new AIRateLimitError();
  }
  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: `Given this ${type} title and content, generate 2-4 search keywords for finding relevant stock photos. Focus on concrete, visual, photographic concepts that would actually appear in news photography or documentary images.

GOOD examples (specific, visual, photographic):
- capitol building washington dc
- hospital doctor medical equipment
- construction workers infrastructure
- classroom students education
- solar panels renewable energy

BAD examples (too abstract, no clear visual):
- government policy legislation
- economic impact financial
- social justice equality

Title: ${title}

Content: ${content.substring(0, 500)}

Return ONLY 2-4 specific visual keywords separated by spaces. No quotes, no explanation:`,
    });

    return text.trim().replace(/['"]/g, '');
  } catch (error) {
    if (isRateLimitError(error)) {
      setRateLimitHit(true);
      throw new AIRateLimitError();
    }
    console.error('Error generating image search keywords:', error);
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 3)
      .join(' ');
  }
}
