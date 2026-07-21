/**
 * AI text generation utilities
 * Generates summaries and full articles from government content
 */

import type { Tool } from "ai";
import {
  APICallError,
  generateObject,
  generateText,
  RetryError,
  stepCountIs,
  tool,
} from "ai";
import { z } from "zod";

import { trackLLMUsage } from "../costs.js";
import { createLogger } from "../log.js";
import { getSearchModel, getTextLlm, getWebSearchTool } from "./provider.js";

const logger = createLogger("ai");

export class AIRateLimitError extends Error {
  constructor() {
    super("LLM rate limit hit — deferring AI generation to next run");
    this.name = "AIRateLimitError";
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
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota")
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
      model: getTextLlm(),
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
    logger.error("Error generating AI summary", error);
    return content.substring(0, 97) + "...";
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
      model: getTextLlm(),
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
    logger.error("Error generating AI article", error);
    return "";
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

/**
 * How the two sides are framed. `left_right` for ideological/partisan splits
 * (progressive vs conservative); `proponent_opponent` for support-vs-oppose
 * splits. `left` is always the progressive/proponent side. Chosen
 * deterministically by content type — see framingForContentType.
 */
export type LensFraming = "proponent_opponent" | "left_right";

/** Content types the dual-lens pipeline runs on. */
export type LensContentType = "bill" | "government_content" | "court_case";

/**
 * Deterministic framing per content type:
 *  - bill           → proponent/opponent (support vs oppose this specific bill)
 *  - government_content (executive actions) → left/right (inherently partisan policy)
 *  - court_case     → proponent/opponent (for vs against the ruling)
 */
export function framingForContentType(type: LensContentType): LensFraming {
  return type === "government_content" ? "left_right" : "proponent_opponent";
}

export interface DualLens {
  framing: LensFraming;
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
function numberSources(
  raw: readonly SdkSource[] | undefined,
): DualLensSource[] {
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
  framing: LensFraming,
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
  return {
    framing,
    left: fix(lens.left),
    right: fix(lens.right),
    sources,
  };
}

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Strip a fetched HTML page down to readable text for the agent to read. */
function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Client tool: web search. Wraps the active provider's server-side web search
 * (which completes in one shot) so the OUTER model drives a genuine multi-step
 * loop — it can search, read a page, then search again. The native search
 * sub-call is tracked separately.
 */
const webResearchTool = tool({
  description:
    "Search the web for information about a topic. Returns a short summary and a list of result sources (title + url).",
  inputSchema: z.object({
    query: z.string().describe("A focused search query."),
  }),
  execute: async ({ query }: { query: string }) => {
    const res = await generateText({
      model: getSearchModel(),
      tools: { web_search: getWebSearchTool() as Tool<any, any> },
      prompt: `Search the web and briefly summarize what you find for: ${query}`,
    });
    trackLLMUsage(res.usage.inputTokens, res.usage.outputTokens);
    const results = ((res.sources ?? []) as SdkSource[])
      .filter((s) => s.sourceType === "url" && s.url)
      .map((s) => ({ title: s.title ?? s.url, url: s.url }));
    return { summary: res.text.slice(0, 1500), results };
  },
});

/**
 * Client tool: read a page in depth (search results are only snippets/summaries).
 * The model calls this to open the most relevant sources before concluding.
 */
const fetchPageTool = tool({
  description:
    "Fetch the readable text of a web page by URL to read a source in depth. Use after web_search to open the most relevant results.",
  inputSchema: z.object({
    url: z
      .string()
      .describe("The full URL to fetch, from a web_search result."),
  }),
  execute: async ({ url }: { url: string }) => {
    try {
      const res = await fetch(url, {
        headers: { Accept: "text/html", "User-Agent": BROWSER_UA },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return { url, error: `HTTP ${res.status}` };
      const text = stripHtml(await res.text()).slice(0, 4000);
      return { url, text };
    } catch (err) {
      return {
        url,
        error: err instanceof Error ? err.message : "fetch failed",
      };
    }
  },
});

/** Collect every source URL surfaced across the loop's tool results, for citations. */
function collectLoopSources(steps: unknown): SdkSource[] {
  const out: SdkSource[] = [];
  for (const step of Array.isArray(steps) ? steps : []) {
    const results = (step as { toolResults?: unknown }).toolResults;
    for (const r of Array.isArray(results) ? results : []) {
      const rr = r as {
        toolName?: string;
        output?: {
          url?: string;
          text?: string;
          results?: { title?: string; url?: string }[];
        };
      };
      if (rr.toolName === "web_search" && Array.isArray(rr.output?.results)) {
        for (const it of rr.output.results) {
          if (it.url)
            out.push({ sourceType: "url", url: it.url, title: it.title });
        }
      } else if (
        rr.toolName === "fetch_page" &&
        rr.output?.url &&
        rr.output.text
      ) {
        out.push({
          sourceType: "url",
          url: rr.output.url,
          title: rr.output.url,
        });
      }
    }
  }
  return out;
}

const RESEARCH_PROMPT = (title: string, type: string, text: string) =>
  `You are a nonpartisan civic analyst researching a ${type}. Your framing must stay balanced, but to capture each side's real arguments you should deliberately seek out sources FROM BOTH SIDES. Work step by step and DO NOT write your briefing until you have read primary sources:
1. Use web_search to find both the strongest case FOR and the strongest case AGAINST — including proponents/campaigns/supportive editorials and critics/opponents/critical editorials, alongside official or nonpartisan analyses for the facts.
2. You MUST then use fetch_page to open and read at least TWO of the most relevant results in full (snippets alone are not enough) — at least one supportive and one critical source.
3. Search or fetch again if either side's case is still weak or one-sided.
4. Only once you have read enough, write a concise briefing of the strongest, most specific real-world arguments from BOTH sides, noting which source URLs back each argument.

Prioritize credible, verifiable sources over neutrality — a partisan source is fine for capturing that side's argument, as long as it's real. Do not editorialize in your own voice.

Title: ${title}

Content excerpt:
${text.substring(0, 3000)}`;

const STRUCTURE_PROMPT = (
  title: string,
  type: string,
  framing: LensFraming,
  research: string,
  sourceList: string,
) =>
  `You are a nonpartisan civic analyst. Using ONLY the research below, produce balanced perspectives on this ${type}. Each side needs 2 to 4 specific points presenting that side's strongest arguments — do not editorialize.

${
  framing === "left_right"
    ? `Frame the two sides ideologically: "left" = the progressive/liberal view, "right" = the conservative view. Set left.stance = "Progressive view" and right.stance = "Conservative view".`
    : `Frame the two sides by support: "left" = proponents/supporters, "right" = opponents/critics. Set left.stance = "Proponents argue" and right.stance = "Opponents counter".`
}

For each point, set "sourceIds" to the numbers of the sources (from the Sources list) that directly support it. If a point isn't backed by a listed source, use an empty array. Never cite a source number that isn't in the list.

Sources:
${sourceList || "(none found — use empty sourceIds arrays)"}

Research:
${research}

Title: ${title}`;

/** Max tool-call rounds in the research loop (bounds cost + latency). */
const RESEARCH_MAX_STEPS = 6;

/**
 * Generate a cited dual-lens for a content item.
 *   (1) A real agentic loop: the active text model drives a multi-step tool loop
 *       (web_search + fetch_page, capped by stopWhen) — it searches, opens and
 *       reads sources, and searches again until it can brief both sides.
 *   (2) The text model structures the briefing into schema-validated perspectives with
 *       per-point citations (generateObject; no manual JSON parsing).
 * Falls back to source-text-only structuring if web research is unavailable.
 */
export async function generateDualLens(
  title: string,
  fullText: string,
  type: string,
  framing: LensFraming,
): Promise<DualLens | null> {
  if (rateLimitHit) {
    throw new AIRateLimitError();
  }

  // Step 1 — model-driven agentic research loop. The standard model drives it
  // (web_search here is a client tool wrapping provider-side search), so it
  // genuinely multi-steps: search -> read a page -> search again -> brief.
  let research = "";
  let sources: DualLensSource[] = [];
  try {
    const res = await generateText({
      model: getTextLlm(),
      tools: { web_search: webResearchTool, fetch_page: fetchPageTool },
      stopWhen: stepCountIs(RESEARCH_MAX_STEPS),
      prompt: RESEARCH_PROMPT(title, type, fullText),
    });
    trackLLMUsage(res.usage.inputTokens, res.usage.outputTokens);
    research = res.text;
    sources = numberSources(collectLoopSources(res.steps));
    logger.info(
      `Dual-lens: research loop ran ${res.steps?.length ?? 1} step(s), ${sources.length} sources for "${title}"`,
    );
  } catch (error) {
    if (isRateLimitError(error)) {
      rateLimitHit = true;
      throw new AIRateLimitError();
    }
    logger.warn(
      `Dual-lens web research failed for "${title}" — falling back to source text`,
      error,
    );
  }

  // Step 2 — structured synthesis (schema-validated; no manual JSON parsing).
  const grounding = research.trim() || fullText.substring(0, 4000);
  const sourceList = sources
    .map((s) => `[${s.id}] ${s.title} — ${s.url}`)
    .join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { object, usage } = await generateObject({
        model: getTextLlm(),
        schema: DualLensSchema,
        prompt: STRUCTURE_PROMPT(title, type, framing, grounding, sourceList),
      });
      trackLLMUsage(usage.inputTokens, usage.outputTokens);
      return verifyCitations(object, framing, sources);
    } catch (error) {
      if (isRateLimitError(error)) {
        rateLimitHit = true;
        throw new AIRateLimitError();
      }
      logger.warn(
        `Dual-lens structuring failed on attempt ${attempt + 1} for "${title}"`,
        error,
      );
      if (attempt === 1) return null;
    }
  }
  return null;
}
