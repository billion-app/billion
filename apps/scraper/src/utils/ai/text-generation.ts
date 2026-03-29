/**
 * AI text generation utilities using OpenAI
 * Generates summaries and full articles from government content
 */

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

/**
 * Generate a concise AI summary (max 100 characters)
 * @param title - Content title
 * @param content - Content to summarize
 * @returns Concise summary string
 */
export async function generateAISummary(
  title: string,
  content: string,
): Promise<string> {
  try {
    const { text } = await generateText({
      model: google('gemini-2.0-flash'),
      prompt: `Generate a concise, engaging summary (max 100 characters) for this government content. Focus on the key action or impact.

Title: ${title}

Content: ${content.substring(0, 2000)}

Summary (max 100 characters):`,
    });

    // Ensure it's under 100 characters
    return text.trim().substring(0, 100);
  } catch (error) {
    console.error('Error generating AI summary:', error);
    // Fallback to simple truncation
    return content.substring(0, 97) + '...';
  }
}

/**
 * Generate a full AI article in accessible, engaging format
 * @param title - Content title
 * @param fullText - Full content text
 * @param type - Content type (bill, executive order, court case, etc.)
 * @param url - Source URL
 * @returns Markdown-formatted article
 */
export async function generateAIArticle(
  title: string,
  fullText: string,
  type: string,
  url: string,
): Promise<string> {
  try {
    console.log(`Generating AI article for: ${title}`);

    const { text } = await generateText({
      model: google('gemini-2.0-flash'),
      prompt: `You are an expert at making government and legal content accessible and engaging for everyday people. Transform the following ${type} into a well-structured, markdown-formatted article.

**Structure your article with these 4 sections:**

## What This Means For You
Write 2-3 concise sentences (max 150 words) that immediately tell everyday people what this means for their lives. Use plain language, avoid jargon, and focus on direct impact. Make it relatable and concrete.

## Overview
Provide a balanced, neutral, and informative explanation of what this ${type} is about. Use engaging storytelling elements while remaining objective. Break down complex concepts, define technical terms, and provide context. Make it interesting to read while being thorough. Aim for 200-400 words.

## Impact & Implications
Explain what this means in practice. Who is affected and how? What are the short-term and long-term implications? What changes as a result? Use real-world examples when possible. Be specific about practical effects. Aim for 200-300 words.

## The Debate
Present both sides of the political spectrum's views on this matter. Give equal weight to supporters and critics. Quote or paraphrase key arguments from both perspectives. Remain objective and let readers understand different viewpoints. Structure this as:
- **Supporters argue:** [their main points]
- **Critics contend:** [their main points]

Aim for 200-300 words, balanced between both sides.

---

**Formatting Guidelines:**
- Use markdown headers (##) for each section
- Use **bold** for emphasis on key terms
- Use bullet points or numbered lists where appropriate
- Include blockquotes (>) for any direct quotes from the original text
- Keep paragraphs short (2-4 sentences) for readability
- Use 8th-grade reading level language
- Define any necessary technical/legal terms inline

**Original Content:**

Title: ${title}
Type: ${type}
URL: ${url}

${fullText}

---

Write the article now using the 4-section structure above:`,
    });

    return text.trim();
  } catch (error) {
    console.error('Error generating AI article:', error);
    // Return empty string on error - will fall back to fullText in UI
    return '';
  }
}
