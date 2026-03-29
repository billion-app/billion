/**
 * AI-powered image keyword generation
 * Uses OpenAI to extract visual concepts for image search
 */

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

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
  try {
    const { text } = await generateText({
      model: google('gemini-2.0-flash'),
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

    return text.trim().replace(/['"]/g, ''); // Remove any quotes
  } catch (error) {
    console.error('Error generating image search keywords:', error);
    // Fallback: use simple keyword extraction from title
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 3)
      .join(' ');
  }
}
