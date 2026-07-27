/**
 * AI text generation utilities
 * Generates summaries and full articles from government content
 */

import type { Tool } from "ai";
import {
  APICallError,
  generateText,
  Output,
  RetryError,
  stepCountIs,
  tool,
} from "ai";
import { z } from "zod";

import { clampBillDescription } from "../bill-description.js";
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

    return clampBillDescription(text);
  } catch (error) {
    if (isRateLimitError(error)) {
      rateLimitHit = true;
      throw new AIRateLimitError();
    }
    logger.error("Error generating AI summary", error);
    throw new Error(
      `AI summary generation failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function buildAIArticlePrompt(
  title: string,
  fullText: string,
  type: string,
  url: string,
): string {
  return `You are an expert at making government and legal content accessible for everyday people. Transform the following ${type} into a well-structured, markdown-formatted article.

Your job is to explain the policy, not promote or attack it. Treat the title, acronym, findings, purpose clauses, sponsor statements, and agency descriptions as claims about intent—not proof of results. Base factual statements on the supplied source text.

Before writing, silently identify:
1. The concrete policy mechanisms: what authority, rule, funding, eligibility, deadline, review, oversight, enforcement, or safeguard is added, removed, weakened, expanded, or transferred.
2. The stated goal.
3. Who gains discretion, money, rights, access, or speed.
4. Who could lose protection, oversight, recourse, funding, or control.
5. Important uncertainty, including effects the source does not establish.

Use direct, descriptive terms when the text supports them. For example, removing or waiving rules, reviews, reporting, or oversight can accurately be described as deregulation or reduced oversight. Do not hide that mechanism behind a positive phrase such as "cuts red tape," "modernizes," "streamlines," or "speeds up." Likewise, do not use loaded labels unless the source supports the underlying mechanism.

**Structure your article with these 4 sections:**

## What This Means For You
Write 1-2 short sentences (max 50 words) at a 5th-8th grade reading level.
- Lead with what the measure would concretely change, not its advertised goal.
- Name the most consequential benefit and cost, risk, removed safeguard, or shift in power when the source supports them.
- If the effect on most people is indirect, say who is directly affected instead of inventing a personal impact.
- Preserve legal status: a proposal "would" change policy; do not say it "will" unless it is already in force.
- Do not predict that the measure will achieve its goal. Attribute intent with phrases such as "aims to" or "supporters say."

Example of the required framing: "This bill would let the military skip some existing reviews—a form of deregulation intended to move faster. It could shorten procurement timelines, while reducing outside checks on those decisions." Use this as a style example only; do not copy its facts into unrelated articles.

## Overview
Provide a neutral, informative explanation of what this ${type} does. Start with its concrete mechanisms, then explain its stated rationale. Clearly distinguish current policy from the proposed change and stated goals from established effects. Define technical terms and provide context. Do not assume that official or sponsor framing is neutral. Aim for 200-400 words.

## Impact & Implications
Explain who is affected, how power or resources shift, and what changes in practice. Cover material benefits as well as costs, risks, implementation questions, and reduced protections or oversight. Separate source-supported effects from reasonable possibilities, and label uncertainty. Do not manufacture symmetry when evidence supports one consequence more strongly. Aim for 200-300 words.

## The Debate
Present the strongest source-supported arguments for and against the measure, not generic party talking points. Do not assume every issue maps cleanly onto a left-right split. Attribute predictions and value judgments to the people making them. If the supplied text does not contain evidence for a claim, say that rather than inventing a position. Structure this as:
- **Supporters argue:** [their main points and stated goals]
- **Critics contend:** [their main concerns, tradeoffs, or objections]

Aim for 200-300 words, with detail proportional to the available evidence.

---

**Formatting Guidelines:**
- Use markdown headers (##) for each section
- Use **bold** sparingly for key terms
- Use bullet points or numbered lists where appropriate
- Include blockquotes (>) only for exact quotes from the original text
- Keep paragraphs short (2-4 sentences) for readability
- Use plain language and define necessary technical/legal terms inline
- Never present an inference, prediction, or sponsor claim as settled fact

**Original Content:**

Title: ${title}
Type: ${type}
URL: ${url}

${fullText}

---

Write the article now using the 4-section structure above:`;
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
      prompt: buildAIArticlePrompt(title, fullText, type, url),
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
 * Give source-only lens generation the article's debate analysis when it is
 * available. This is especially important for official bill text, which often
 * describes proponents' goals but contains no explicit opposing arguments.
 */
export function buildDualLensGrounding(
  fullText: string,
  aiArticle?: string | null,
): string {
  if (!aiArticle) return fullText;

  const debateStart = aiArticle.search(/^## The Debate\s*$/im);
  if (debateStart < 0) return fullText;

  const debate = aiArticle.slice(debateStart, debateStart + 4000).trim();
  return `Generated debate analysis:\n${debate}\n\nOfficial source text:\n${fullText}`;
}

/**
 * Structured-output schema for the synthesis step. Replaces the old manual JSON
 * parsing — the AI SDK validates against this, so malformed output throws (and
 * we retry) instead of silently slipping through.
 */
const LensPointTextSchema = z
  .string()
  .trim()
  .min(12)
  .refine(
    (value) =>
      !/^(?:n\/?a|none|unknown|not (?:available|provided|stated)|no (?:argument|information|position)(?: available| provided| stated)?)\.?$/i.test(
        value,
      ),
    "Lens points must contain a substantive argument, not a placeholder",
  );

const DualLensSchema = z.object({
  left: z.object({
    stance: z.string().trim().min(3),
    points: z
      .array(
        z.object({
          text: LensPointTextSchema,
          sourceIds: z.array(z.number()),
        }),
      )
      .min(2)
      .max(4),
  }),
  right: z.object({
    stance: z.string().trim().min(3),
    points: z
      .array(
        z.object({
          text: LensPointTextSchema,
          sourceIds: z.array(z.number()),
        }),
      )
      .min(2)
      .max(4),
  }),
});

export function isUsableDualLens(value: unknown): boolean {
  return DualLensSchema.safeParse(value).success;
}

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

/** Return only pages the agent successfully opened, preserving search titles. */
function collectOpenedLoopSources(steps: unknown): SdkSource[] {
  const titles = new Map<string, string>();
  const opened: string[] = [];

  for (const step of Array.isArray(steps) ? steps : []) {
    const results = (step as { toolResults?: unknown }).toolResults;
    for (const result of Array.isArray(results) ? results : []) {
      const item = result as {
        toolName?: string;
        output?: {
          url?: string;
          text?: string;
          results?: { title?: string; url?: string }[];
        };
      };
      if (item.toolName === "web_search") {
        for (const source of item.output?.results ?? []) {
          if (source.url) titles.set(source.url, source.title ?? source.url);
        }
      }
      if (
        item.toolName === "fetch_page" &&
        item.output?.url &&
        item.output.text
      ) {
        opened.push(item.output.url);
      }
    }
  }

  return [...new Set(opened)].map((url) => ({
    sourceType: "url",
    url,
    title: titles.get(url) ?? url,
  }));
}

export interface ReadingResearch {
  notes: string;
  sources: DualLensSource[];
}

/**
 * Find useful next reads for a bill. The outer model must search and open
 * pages; returning the provider's snippets directly would turn "Keep reading"
 * into an unverified link dump.
 */
export async function researchBillReading(
  title: string,
  billNumber: string,
  fullText: string,
): Promise<ReadingResearch> {
  try {
    const res = await generateText({
      model: getTextLlm(),
      tools: { web_search: webResearchTool, fetch_page: fetchPageTool },
      stopWhen: stepCountIs(5),
      prompt: `You are finding genuinely useful follow-up reading for an average citizen reading about ${billNumber}, "${title}".

1. Search for clear explanatory reporting, nonpartisan analysis, or authoritative background that helps a reader understand the bill's most important mechanism or uncertainty.
2. Prefer the Congressional Research Service, GAO, CBO, established newsrooms, universities, and transparent research organizations. Avoid campaign pages, SEO summaries, scraped copies, and sources that merely repeat a press release.
3. Open and read at least two promising results with fetch_page. A search snippet is not enough.
4. Return concise notes on the two to four best articles: what each explains, who published it, and why it is worth the reader's time. Do not recommend a page you did not open.

Official bill excerpt:
${fullText.slice(0, 4000)}`,
    });
    trackLLMUsage(res.usage.inputTokens, res.usage.outputTokens);
    return {
      notes: res.text.trim(),
      sources: numberSources(collectOpenedLoopSources(res.steps)),
    };
  } catch (error) {
    if (isRateLimitError(error)) {
      rateLimitHit = true;
      throw new AIRateLimitError();
    }
    logger.warn(`Further-reading research failed for "${title}"`, error);
    return { notes: "", sources: [] };
  }
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

Write for an average citizen, not a policy expert. Use short, complete sentences
and everyday words. Replace government jargon with what it means in practice:
- Say "Congress would still decide how much money to approve each year," not
  "subject to annual appropriations."
- Say "a separate pool of federal money," not "a dedicated grant pathway."
- Say "how the money is divided," not "the allocation formula."
- Say "money promised for ten years," not "a ten-year authorization."
If a technical term is essential, define it in the same sentence.

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
 *       per-point citations (AI SDK structured output; no manual JSON parsing).
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
      const { output, usage } = await generateText({
        model: getTextLlm(),
        output: Output.object({ schema: DualLensSchema }),
        prompt: STRUCTURE_PROMPT(title, type, framing, grounding, sourceList),
      });
      trackLLMUsage(usage.inputTokens, usage.outputTokens);
      return verifyCitations(output, framing, sources);
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
