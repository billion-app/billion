/**
 * AI text generation utilities
 * Generates summaries and full articles from government content
 */

import { APICallError, generateText, Output, RetryError } from "ai";
import { z } from "zod";

import type {
  BillLifecycleAction,
  DerivedBillLifecycle,
} from "@acme/validators";
import { deriveBillLifecycle } from "@acme/validators";

import { researchContent } from "../../research/shared.js";
import { clampBillDescription } from "../bill-description.js";
import { trackLLMUsage } from "../costs.js";
import { createLogger } from "../log.js";
import { getTextLlm } from "./provider.js";

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

export interface BillSummaryContext {
  billNumber?: string | null;
  status?: string | null;
  actions?: readonly BillLifecycleAction[] | null;
}

export function buildAISummaryPrompt(
  title: string,
  content: string,
  context?: BillSummaryContext,
): string {
  const sourceLimit = context ? 32_000 : 2_000;
  const sourceText = content.substring(0, sourceLimit);
  const lifecycle = context
    ? deriveBillLifecycle({
        billNumber: context.billNumber,
        actions: context.actions,
        latestAction: context.status,
      })
    : undefined;
  const lines = [
    "You are an expert at simplifying complex government and legal jargon for a general audience.",
    "Generate a very short, punchy summary (max 100 characters) for this content.",
    "",
    context
      ? "Goal: Tell a regular person what this measure would do or what official action occurred, in one quick sentence."
      : 'Goal: Tell a regular person "what happened" or "what changed" in one quick sentence.',
    "Style: Use active voice, plain English (8th-grade level), and NO jargon. Focus on the direct impact.",
    "Keep the mechanism and scope precise: a condition on receiving federal funds limits funding eligibility for the covered recipients; it does not by itself ban the underlying activity or all institutions.",
  ];
  if (context) {
    lines.push(
      "",
      lifecycle?.status.startsWith("adopted_")
        ? "Distinguish the recorded adoption event from policy language; summarize only that event unless the source clearly states a separate effect."
        : 'Distinguish paragraphs labeled "Existing law" from "This bill would." Summarize only changes supported by the source; do not infer new effects from the title, introduction, findings, or existing law alone.',
    );
  }
  if (lifecycle) {
    const adoptedResolution = lifecycle.status.startsWith("adopted_");
    lines.push("", "Official legislative status: " + lifecycle.label + ".");
    lines.push(
      adoptedResolution
        ? "This resolution's recorded adoption may be described as a completed event, but it is not a law."
        : lifecycle.hasCompletedVote
          ? "The card already shows the recorded chamber milestone. Focus this sentence on what the proposal would do; do not turn one chamber vote into a claim that Congress voted on the policy."
          : "No completed chamber vote is recorded. Do not say Congress, the House, or the Senate voted to approve, block, or adopt this measure.",
    );
    lines.push(
      lifecycle.isEnacted
        ? "This measure is enacted, so present-tense effects are allowed. Do not claim it is currently in force or applies now unless the source gives an effective date or implementation detail."
        : "This measure is not enacted. Every policy effect must use explicit conditional language such as 'would' or 'would have'; 'could' or 'aims to' may add nuance but cannot replace that framing. Never say it 'will' or that it already bans, blocks, requires, or changes something.",
    );
  }
  if (context && content.length > sourceLimit) {
    lines.push(
      "",
      `Source text is truncated to the first ${sourceLimit} characters. Do not infer provisions omitted from the excerpt.`,
    );
  }
  lines.push(
    "",
    "Title: " + title,
    "",
    "Content: " + sourceText,
    "",
    "Summary (max 100 characters):",
  );
  return lines.join("\n");
}

export function invalidBillSummaryReason(
  summary: string,
  lifecycle: DerivedBillLifecycle,
): string | undefined {
  const text = summary.replace(/\s+/g, " ").trim();
  if (lifecycle.isEnacted) {
    if (/\bwould\b/i.test(text)) {
      return "uses conditional language for a measure that is already enacted";
    }
    return undefined;
  }
  if (/\b(?:will|is going to)\b/i.test(text)) {
    return "uses future certainty for a measure that is not enacted";
  }
  if (
    /\b(?:this|the)\s+(?:bill|measure|resolution|law)\s+(?:bans?|blocks?|prohibits?|requires?|stops?|limits?|creates?|establishes?|allows?|gives?|funds?|authorizes?)\b/i.test(
      text,
    )
  ) {
    return "states a proposal's policy effect as present fact";
  }
  if (/\b(?:now|currently|already)\b/i.test(text)) {
    return "uses present-time language for a measure that is not enacted";
  }
  if (
    !lifecycle.status.startsWith("adopted_") &&
    /\b(?:congress|the house|the senate)\s+(?:voted|votes|passed|approved|adopted|blocked|rejected)\b/i.test(
      text,
    )
  ) {
    return "claims a completed congressional vote that the action record does not contain";
  }
  if (!lifecycle.status.startsWith("adopted_") && !/\bwould\b/i.test(text)) {
    return "does not use explicit conditional language for a measure that is not enacted";
  }
  return undefined;
}

/** Whether an existing generated description should be regenerated for the
 * current source lifecycle. Source-owned descriptions are handled by the
 * caller and should not use this check. */
export function needsBillSummaryRegeneration(
  summary: string | null | undefined,
  context: BillSummaryContext,
): boolean {
  if (!summary?.trim()) return true;
  const lifecycle = deriveBillLifecycle({
    billNumber: context.billNumber,
    actions: context.actions,
    latestAction: context.status,
  });
  return invalidBillSummaryReason(summary, lifecycle) !== undefined;
}

/**
 * Generate a concise AI summary (max 100 characters). Bill summaries carry
 * the structured action record into the prompt and are checked once after
 * generation. A bad tense is retried with the exact reason; it is never
 * repaired with a blind string replacement.
 * @param title - Content title
 * @param content - Content to summarize
 * @returns Concise summary string
 */
export async function generateAISummary(
  title: string,
  content: string,
  context?: BillSummaryContext,
): Promise<string> {
  if (rateLimitHit) {
    throw new AIRateLimitError();
  }
  try {
    const lifecycle = context
      ? deriveBillLifecycle({
          billNumber: context.billNumber,
          actions: context.actions,
          latestAction: context.status,
        })
      : undefined;
    const basePrompt = buildAISummaryPrompt(title, content, context);
    let lastReason: string | undefined;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const prompt = lastReason
        ? basePrompt +
          "\n\nPrevious output was rejected because it " +
          lastReason +
          ". Rewrite it using the lifecycle rules above."
        : basePrompt;
      const { text, usage } = await generateText({
        model: getTextLlm(),
        prompt,
      });
      trackLLMUsage(usage.inputTokens, usage.outputTokens);

      const summary = clampBillDescription(text);
      if (!lifecycle) return summary;
      lastReason = invalidBillSummaryReason(summary, lifecycle);
      if (!lastReason) return summary;
    }
    throw new Error(
      "AI summary failed lifecycle validation: " +
        (lastReason ?? "unknown reason"),
    );
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

export interface LensExample {
  fact: string;
  relevance: string;
}

export interface LensPoint {
  text: string;
  /** A documented precedent or observed result that makes the argument concrete. */
  example?: LensExample;
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
 * How the two sides are framed. New lenses always use support-vs-oppose.
 * `left_right` remains in the type while older cached rows are migrated.
 */
export type LensFraming = "proponent_opponent" | "left_right";

/** Content types the dual-lens pipeline runs on. */
export type LensContentType = "bill" | "government_content" | "court_case";

/** Every content type uses the same neutral support-vs-oppose framing. */
export function framingForContentType(_type: LensContentType): LensFraming {
  return "proponent_opponent";
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

const LensPointSchema = z.object({
  text: LensPointTextSchema,
  example: z.object({
    fact: LensPointTextSchema.describe(
      "A documented precedent, policy, case, or measured outcome",
    ),
    relevance: z
      .string()
      .trim()
      .min(30)
      .describe(
        "A plain-language explanation of exactly how the fact supports or limits this argument",
      ),
  }),
  sourceIds: z.array(z.number()).min(1),
});

/** New generations must ground every argument in a cited concrete example. */
const GeneratedDualLensSchema = z.object({
  left: z.object({
    stance: z.literal("Proponents argue"),
    points: z.array(LensPointSchema).min(2).max(4),
  }),
  right: z.object({
    stance: z.literal("Opponents counter"),
    points: z.array(LensPointSchema).min(2).max(4),
  }),
});

/** Accept older cached rows while the scraper refreshes them to the new shape. */
const CompatibleDualLensSchema = z.object({
  left: z.object({
    stance: z.string().trim().min(3),
    points: z
      .array(
        z.object({
          text: LensPointTextSchema,
          example: z
            .union([
              LensPointTextSchema,
              z.object({
                fact: LensPointTextSchema,
                relevance: z.string().trim().min(12),
              }),
            ])
            .optional(),
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
          example: z
            .union([
              LensPointTextSchema,
              z.object({
                fact: LensPointTextSchema,
                relevance: z.string().trim().min(12),
              }),
            ])
            .optional(),
          sourceIds: z.array(z.number()),
        }),
      )
      .min(2)
      .max(4),
  }),
});

export function isUsableDualLens(value: unknown): boolean {
  return CompatibleDualLensSchema.safeParse(value).success;
}

/**
 * Well-engineered citations: strip any sourceId the model invented that doesn't
 * resolve to a real fetched source, so every rendered citation number is backed
 * by an actual URL. The caller rejects the result if that leaves an example
 * without a citation.
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
      ...(p.example ? { example: p.example } : {}),
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

/**
 * How much of a bill's text the AI steps read.
 *
 * One number for every step on purpose. It used to be per-call — 3k for the
 * lens research, 4k for the context research, 24k for the brief — and the
 * mismatch was invisible until it produced visibly wrong output: H.R. 7008's
 * photo-ID rider starts at character 7,961 of a 14,741-character bill, so the
 * brief (24k) described it while the reading list (4k) recommended nothing but
 * insider-trading background, because its researcher never saw that the bill
 * touched voting at all.
 *
 * Bills routinely run past this. Quote verification still runs against the
 * *whole* stored text, so a quote from anywhere in the document validates.
 * Section-aware windowing (#191) is what actually fixes long bills; this is the
 * ceiling until then.
 */
export const SOURCE_WINDOW = 24_000;

export interface BillContextResearch {
  notes: string;
  sources: DualLensSource[];
}

/**
 * Research both the bill's historical context and useful next reads. The outer
 * model must search and open pages; snippets alone cannot support a claim about
 * why an earlier proposal stalled or make a trustworthy reading recommendation.
 */
export async function researchBillContext(
  title: string,
  _billNumber: string,
  fullText: string,
  sourceUrl?: string,
): Promise<BillContextResearch> {
  try {
    return await researchContent({ title, fullText, type: "bill", sourceUrl });
  } catch (error) {
    if (isRateLimitError(error)) {
      rateLimitHit = true;
      throw new AIRateLimitError();
    }
    logger.warn(`Bill-context research unavailable for "${title}"`, error);
    return { notes: "", sources: [] };
  }
}

const STRUCTURE_PROMPT = (
  title: string,
  type: string,
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

Frame the two sides by support: "left" = proponents/supporters, "right" =
opponents/critics. Set left.stance = "Proponents argue" and right.stance =
"Opponents counter".

For each point, set "sourceIds" to the numbers of the sources (from the Sources
list) that directly support both the argument and its example. Omit an
unsupported point instead of using an empty array. Never cite a source number
that isn't in the list.

Every point must also include an "example" object with TWO distinct fields:
- "fact": one short, complete sentence naming a documented precedent or
  observed result. Good facts name a state, country, agency, earlier bill,
  court case, company, year, or measured outcome.
- "relevance": one or two complete sentences explaining, in everyday language,
  exactly how that fact demonstrates, supports, or limits the argument
  immediately above it. Name the shared mechanism, right, cost, omission, or
  tradeoff. Do not merely say "this is relevant" or repeat the argument.

A related fact with no specific relevance explanation is invalid. Do not invent
a scenario. You may compare a documented existing policy with a specific
provision or omission in this proposal, but make both sides of that comparison
explicit. The fact, relevance explanation, and argument must be backed by at
least one listed source, so every sourceIds array must contain a valid source
number.

Sources:
${sourceList || "(none found — cited concrete examples cannot be generated)"}

Research:
${research}

Title: ${title}`;

/**
 * Generate a cited dual-lens for a content item.
 *   (1) Reuse the source revision's persistent evidence collection, shared with
 *       bill context and further reading. Only opened documents can be cited.
 *   (2) The text model structures the briefing into schema-validated perspectives with
 *       per-point citations (AI SDK structured output; no manual JSON parsing).
 * Returns null if research cannot supply cited concrete examples; the official
 * source alone is not enough to invent a precedent.
 */
export async function generateDualLens(
  title: string,
  fullText: string,
  type: string,
  framing: LensFraming,
  sourceUrl?: string,
): Promise<DualLens | null> {
  if (rateLimitHit) {
    throw new AIRateLimitError();
  }

  // Reuse the same evidence collection as the structured brief.
  let research = "";
  let sources: DualLensSource[] = [];
  try {
    const packet = await researchContent({ title, fullText, type, sourceUrl });
    research = packet.notes;
    sources = packet.sources.map(({ id, title, url }) => ({ id, title, url }));
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
  const grounding = research.trim() || fullText.substring(0, SOURCE_WINDOW);
  const sourceList = sources
    .map((s) => `[${s.id}] ${s.title} — ${s.url}`)
    .join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output, usage } = await generateText({
        model: getTextLlm(),
        output: Output.object({ schema: GeneratedDualLensSchema }),
        prompt: STRUCTURE_PROMPT(title, type, grounding, sourceList),
      });
      trackLLMUsage(usage.inputTokens, usage.outputTokens);
      const verified = verifyCitations(output, framing, sources);
      if (!GeneratedDualLensSchema.safeParse(verified).success) {
        throw new Error(
          "Dual-lens examples must retain at least one verified citation",
        );
      }
      return verified;
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
