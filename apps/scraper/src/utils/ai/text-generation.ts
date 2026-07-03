/**
 * AI text generation utilities
 * Generates summaries and full articles from government content
 */

import { generateText, generateObject, APICallError, RetryError } from 'ai';
import { z } from 'zod';
import { createLogger } from '../log.js';
import { trackLLMUsage } from '../costs.js';
import { llm, searchModel, webSearchTool } from './provider.js';

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
 * @returns Markdown-formatted article
 */
export async function generateAIArticle(
  title: string,
  fullText: string,
  type: string,
  url: string,
): Promise<string> {
  if (rateLimitHit) {
    throw new AIRateLimitError();
  }
  try {
    logger.start(`Generating AI article for: ${title}`);

    const { text, usage } = await generateText({
      model: llm,
      prompt: `You are an expert at making government and legal content accessible and engaging for everyday people. Transform the following ${type} into a well-structured, markdown-formatted article.

**Structure your article with these 4 sections:**

## What This Means For You
Write 1-2 very short, punchy sentences (max 50 words) that immediately tell a regular person how this affects their life. Use 5th-8th grade reading level. Completely avoid legal or technical terms. Focus on the "so what?"—the direct, practical result for everyday people. Make it feel human and relevant.

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

export interface LensPoint {
  text: string;
  /** Ids into DualLens.sources backing this point (may be empty). */
  sourceIds: number[];
}

export interface LensSide {
  stance: string;
  points: LensPoint[];
}

export interface DualLensSource {
  id: number;
  title: string;
  url: string;
}

export interface DualLens {
  left: LensSide;
  right: LensSide;
  sources: DualLensSource[];
}

/**
 * Structured-output schema for the synthesis step. Replaces the old manual JSON
 * parsing — the AI SDK validates against this, so malformed output throws (and
 * we retry) instead of silently slipping through.
 */
const DualLensSchema = z.object({
  left: z.object({
    stance: z.string(),
    points: z
      .array(z.object({ text: z.string(), sourceIds: z.array(z.number()) }))
      .min(2)
      .max(4),
  }),
  right: z.object({
    stance: z.string(),
    points: z
      .array(z.object({ text: z.string(), sourceIds: z.array(z.number()) }))
      .min(2)
      .max(4),
  }),
});

/** Web-search results surfaced by the AI SDK, as returned by generateText. */
interface SdkSource {
  sourceType?: string;
  url?: string;
  title?: string;
}

/** Dedupe web-search sources by URL and assign stable 1-based citation ids. */
function numberSources(raw: readonly SdkSource[] | undefined): DualLensSource[] {
  const byUrl = new Map<string, number>();
  const out: DualLensSource[] = [];
  for (const s of raw ?? []) {
    if (s.sourceType !== "url" || !s.url || byUrl.has(s.url)) continue;
    const id = out.length + 1;
    byUrl.set(s.url, id);
    out.push({ id, title: s.title?.trim() || s.url, url: s.url });
  }
  return out;
}

/**
 * Well-engineered citations: strip any sourceId the model invented that doesn't
 * resolve to a real fetched source, so every rendered citation number is backed
 * by an actual URL (points are kept even if uncited, preserving the ≥2 shape).
 */
function verifyCitations(
  lens: { left: LensSide; right: LensSide },
  sources: DualLensSource[],
): DualLens {
  const valid = new Set(sources.map((s) => s.id));
  const fix = (side: LensSide): LensSide => ({
    stance: side.stance,
    points: side.points.map((p) => ({
      text: p.text,
      sourceIds: [...new Set(p.sourceIds.filter((id) => valid.has(id)))],
    })),
  });
  return { left: fix(lens.left), right: fix(lens.right), sources };
}

const RESEARCH_PROMPT = (title: string, type: string, text: string) =>
  `You are a nonpartisan civic analyst researching a ${type}. Use web search to find how supporters and critics actually view it. Gather the strongest, most specific real-world arguments from BOTH sides, and note which sources back each argument. Prefer official, nonpartisan, and reputable sources. Do not editorialize.

Title: ${title}

Content excerpt:
${text.substring(0, 3000)}`;

const STRUCTURE_PROMPT = (
  title: string,
  type: string,
  research: string,
  sourceList: string,
) =>
  `You are a nonpartisan civic analyst. Using ONLY the research below, produce balanced perspectives on this ${type}: "left" = proponents/supporters, "right" = critics/opponents. Each side needs 2 to 4 specific points presenting that side's strongest arguments — do not editorialize.

For each point, set "sourceIds" to the numbers of the sources (from the Sources list) that directly support it. If a point isn't backed by a listed source, use an empty array. Never cite a source number that isn't in the list. Suggested stances: left = "Proponents argue", right = "Critics counter".

Sources:
${sourceList || "(none found — use empty sourceIds arrays)"}

Research:
${research}

Title: ${title}`;

/**
 * Generate a cited dual-lens for a content item via a real agentic loop:
 *   (1) DeepSeek researches the web with its native web_search tool,
 *   (2) DeepSeek structures the findings into schema-validated perspectives with
 *       per-point citations.
 * Falls back to source-text-only structuring if web research is unavailable.
 */
export async function generateDualLens(
  title: string,
  fullText: string,
  type: string,
): Promise<DualLens | null> {
  if (rateLimitHit) {
    throw new AIRateLimitError();
  }

  // Step 1 — agentic web research (native DeepSeek web_search).
  let research = "";
  let sources: DualLensSource[] = [];
  try {
    const res = await generateText({
      model: searchModel,
      tools: { web_search: webSearchTool },
      prompt: RESEARCH_PROMPT(title, type, fullText),
    });
    trackLLMUsage(res.usage.inputTokens, res.usage.outputTokens);
    research = res.text;
    sources = numberSources(res.sources as SdkSource[] | undefined);
    logger.info(`Dual-lens: web research found ${sources.length} sources for "${title}"`);
  } catch (error) {
    if (isRateLimitError(error)) {
      rateLimitHit = true;
      throw new AIRateLimitError();
    }
    logger.warn(`Dual-lens web research failed for "${title}" — falling back to source text`, error);
  }

  // Step 2 — structured synthesis (schema-validated; no manual JSON parsing).
  const grounding = research.trim() || fullText.substring(0, 4000);
  const sourceList = sources.map((s) => `[${s.id}] ${s.title} — ${s.url}`).join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { object, usage } = await generateObject({
        model: llm,
        schema: DualLensSchema,
        prompt: STRUCTURE_PROMPT(title, type, grounding, sourceList),
      });
      trackLLMUsage(usage.inputTokens, usage.outputTokens);
      return verifyCitations(object, sources);
    } catch (error) {
      if (isRateLimitError(error)) {
        rateLimitHit = true;
        throw new AIRateLimitError();
      }
      logger.warn(`Dual-lens structuring failed on attempt ${attempt + 1} for "${title}"`, error);
      if (attempt === 1) return null;
    }
  }
  return null;
}
