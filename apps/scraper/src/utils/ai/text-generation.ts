/**
 * AI text generation utilities
 * Generates summaries and full articles from government content
 */

import { generateText, APICallError, RetryError } from 'ai';
import { createLogger } from '../log.js';
import { trackLLMUsage } from '../costs.js';
import { llm } from './provider.js';

const logger = createLogger("ai");

export class AIRateLimitError extends Error {
  constructor() {
    super('LLM rate limit hit — deferring AI generation to next run');
    this.name = 'AIRateLimitError';
  }
}

export let rateLimitHit = false;

export function setRateLimitHit(v: boolean) {
  rateLimitHit = v;
}

function isRateLimitError(error: unknown): boolean {
  // Vercel AI SDK: APICallError has statusCode, RetryError wraps it in lastError
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
 * Generate a concise AI summary (max 100 characters)
 * @param title - Content title
 * @param content - Content to summarize
 * @returns Concise summary string
 */
export async function generateAISummary(
  title: string,
  content: string,
): Promise<string> {
  if (rateLimitHit) {
    throw new AIRateLimitError();
  }
  try {
    const { text, usage } = await generateText({
      model: llm,
      prompt: `You are an expert at simplifying complex government and legal jargon for a general audience.
Generate a very short, punchy summary (max 100 characters) for this content.

Goal: Tell a regular person "what happened" or "what changed" in one quick sentence.
Style: Use active voice, plain English (8th-grade level), and NO jargon. Focus on the direct impact.

Title: ${title}

Content: ${content.substring(0, 2000)}

Summary (max 100 characters):`,
    });
    trackLLMUsage(usage.inputTokens, usage.outputTokens);

    return text.trim().substring(0, 100);
  } catch (error) {
    if (isRateLimitError(error)) {
      rateLimitHit = true;
      throw new AIRateLimitError();
    }
    logger.error('Error generating AI summary', error);
    return content.substring(0, 97) + '...';
  }
}

/**
 * Generate a full AI article in accessible, engaging format
 * @param title - Content title
 * @param fullText - Full content text
 * @param type - Content type (bill, executive order, court case, etc.)
 * @param url - Source URL
 * @param length - Article length preset (default: 'standard')
 * @param readingLevel - Target reading level (default: 'accessible')
 * @returns Markdown-formatted article
 */
export type ExplainerLength = 'concise' | 'standard' | 'comprehensive';
export type ExplainerReadingLevel = 'technical' | 'accessible' | 'balanced';

const SECTION_WORD_COUNTS: Record<ExplainerLength, { lede: string; overview: string; impact: string; debate: string }> = {
  concise: {
    lede: 'max 30 words',
    overview: '80-120 words',
    impact: '60-80 words',
    debate: '60-80 words',
  },
  standard: {
    lede: 'max 50 words',
    overview: '200-400 words',
    impact: '200-300 words',
    debate: '200-300 words',
  },
  comprehensive: {
    lede: 'max 75 words',
    overview: '400-600 words',
    impact: '400-500 words',
    debate: '400-500 words',
  },
};

const READING_LEVEL_INSTRUCTIONS: Record<ExplainerReadingLevel, string> = {
  accessible: 'Use 8th-grade reading level language. Define any necessary technical/legal terms inline.',
  technical: 'Use precise legal and policy terminology. Assume the reader has professional or policy background. Include relevant statutory or regulatory references where useful. Do not define common legal terms.',
  balanced: 'Balance accessible language with technical precision. Define specialized acronyms and major jargon inline, but allow moderate complexity elsewhere.',
};

export async function generateAIArticle(
  title: string,
  fullText: string,
  type: string,
  url: string,
  length: ExplainerLength = 'standard',
  readingLevel: ExplainerReadingLevel = 'accessible',
): Promise<string> {
  if (rateLimitHit) {
    throw new AIRateLimitError();
  }
  try {
    logger.start(`Generating AI article for: ${title}`);

    const wc = SECTION_WORD_COUNTS[length];
    const readingLevelInstruction = READING_LEVEL_INSTRUCTIONS[readingLevel];

    const { text, usage } = await generateText({
      model: llm,
      prompt: `You are an expert at making government and legal content accessible and engaging for everyday people. Transform the following ${type} into a well-structured, markdown-formatted article.

**Structure your article with these 4 sections:**

## What This Means For You
Write 1-2 very short, punchy sentences (${wc.lede}) that immediately tell a regular person how this affects their life. Focus on the "so what?"—the direct, practical result for everyday people. Make it feel human and relevant.

## Overview
Provide a balanced, neutral, and informative explanation of what this ${type} is about. Use engaging storytelling elements while remaining objective. Break down complex concepts and provide context. Make it interesting to read while being thorough. Aim for ${wc.overview}.

## Impact & Implications
Explain what this means in practice. Who is affected and how? What are the short-term and long-term implications? What changes as a result? Use real-world examples when possible. Be specific about practical effects. Aim for ${wc.impact}.

## The Debate
Present both sides of the political spectrum's views on this matter. Give equal weight to supporters and critics. Quote or paraphrase key arguments from both perspectives. Remain objective and let readers understand different viewpoints. Structure this as:
- **Supporters argue:** [their main points]
- **Critics contend:** [their main points]

Aim for ${wc.debate}, balanced between both sides.

---

**Formatting Guidelines:**
- Use markdown headers (##) for each section
- Use **bold** for emphasis on key terms
- Use bullet points or numbered lists where appropriate
- Include blockquotes (>) for any direct quotes from the original text
- Keep paragraphs short (2-4 sentences) for readability
- ${readingLevelInstruction}

**Original Content:**

Title: ${title}
Type: ${type}
URL: ${url}

${fullText}

---

Write the article now using the 4-section structure above:`,
    });
    trackLLMUsage(usage.inputTokens, usage.outputTokens);

    return text.trim();
  } catch (error) {
    if (isRateLimitError(error)) {
      rateLimitHit = true;
      throw new AIRateLimitError();
    }
    logger.error('Error generating AI article', error);
    return '';
  }
}

export interface LensSide {
  stance: string;
  points: string[];
}

export interface DualLens {
  left: LensSide;
  right: LensSide;
}

function parseLensJSON(raw: string): DualLens | null {
  try {
    const json = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return null;
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed !== 'object' || parsed === null ||
      !('left' in parsed) || !('right' in parsed)
    ) return null;
    const { left, right } = parsed as Record<string, unknown>;
    if (
      typeof left !== 'object' || left === null ||
      typeof right !== 'object' || right === null
    ) return null;
    const l = left as Record<string, unknown>;
    const r = right as Record<string, unknown>;
    if (
      typeof l.stance !== 'string' || !Array.isArray(l.points) ||
      typeof r.stance !== 'string' || !Array.isArray(r.points)
    ) return null;
    const leftPoints = (l.points as unknown[]).filter((p): p is string => typeof p === 'string');
    const rightPoints = (r.points as unknown[]).filter((p): p is string => typeof p === 'string');
    if (leftPoints.length < 2 || rightPoints.length < 2) return null;
    return {
      left: { stance: l.stance, points: leftPoints.slice(0, 4) },
      right: { stance: r.stance, points: rightPoints.slice(0, 4) },
    };
  } catch {
    return null;
  }
}

const DUAL_LENS_PROMPT = (title: string, type: string, text: string) => `You are a nonpartisan civic analyst. Given the following ${type}, produce balanced perspectives from supporters and critics. Cite specific provisions, sections, or precedents from the source text. Do not editorialize — present each side's strongest arguments.

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "left": {
    "stance": "Proponents argue",
    "points": ["2 to 4 specific arguments citing the text"]
  },
  "right": {
    "stance": "Critics counter",
    "points": ["2 to 4 specific arguments citing the text"]
  }
}

Title: ${title}

Content:
${text.substring(0, 4000)}`;

export async function generateDualLens(
  title: string,
  fullText: string,
  type: string,
): Promise<DualLens | null> {
  if (rateLimitHit) {
    throw new AIRateLimitError();
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text, usage } = await generateText({
        model: llm,
        prompt: DUAL_LENS_PROMPT(title, type, fullText),
      });
      trackLLMUsage(usage.inputTokens, usage.outputTokens);
      const lens = parseLensJSON(text);
      if (lens) return lens;
      logger.warn(`Dual-lens parse failed on attempt ${attempt + 1} for "${title}" — retrying`);
    } catch (error) {
      if (isRateLimitError(error)) {
        rateLimitHit = true;
        throw new AIRateLimitError();
      }
      logger.error(`Dual-lens generation error on attempt ${attempt + 1}`, error);
      if (attempt === 1) return null;
    }
  }
  return null;
}
