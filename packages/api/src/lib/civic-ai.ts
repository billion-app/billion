/**
 * AI generation for civic content, via the generic `llm` provider (DeepSeek by
 * default, OpenAI fallback — see ai-provider.ts).
 *
 * Scope is deliberately narrow. AI **structures and summarizes existing source
 * text**; it never authors measure content from a bare title. `generateMeasureSummary`
 * therefore *requires* real fetched source text and refuses to run without it,
 * so an AI summary is always grounded in — and points back to — a real source.
 */

import { generateText } from "ai";

import { llm } from "./ai-provider";

/** Minimum length of source text we'll trust enough to summarize. */
const MIN_GROUNDING_CHARS = 200;

/** Sentinel the model is told to return when source text is too thin. */
const INSUFFICIENT = "INSUFFICIENT";

export async function generateRoleDescription(
  office: string,
  role?: string,
  level?: string,
  district?: string,
): Promise<string> {
  if (!llm) throw new Error("no AI provider configured");
  const prompt = `You write short civic education descriptions for a voter information app.

Describe what the following elected office does and why it matters to voters. Be factual, neutral, and specific.

Office: ${office}
${role ? `Role type: ${role}` : ""}
${level ? `Government level: ${level}` : ""}
${district ? `District: ${district}` : ""}

Rules:
- 2-3 sentences max
- Plain English, no jargon
- Focus on what this person actually does day-to-day and what power they have
- Do not include the office name in your response (the reader already sees it)
- Do not start with "This office" or "This role"

Return only the description text.`;

  const { text } = await generateText({
    model: llm,
    temperature: 0.3,
    prompt,
  });
  return text.trim();
}

/**
 * Summarize a ballot measure **from fetched source text only**.
 *
 * @param title         The measure title (for orientation, NOT a content source).
 * @param groundingText Real text fetched from authoritative/nonpartisan sources.
 *                      Must be substantive — we refuse to summarize from a title.
 * @throws if no AI provider is configured, the grounding text is too thin, or
 *         the model judges the source insufficient (so the UI shows "No
 *         information available" rather than a guess).
 */
export async function generateMeasureSummary(
  title: string,
  groundingText: string,
): Promise<string> {
  if (!llm) throw new Error("no AI provider configured");
  if (groundingText.trim().length < MIN_GROUNDING_CHARS) {
    throw new Error("insufficient grounding text — refusing to summarize");
  }

  const prompt = `You write neutral ballot measure summaries for a voter information app.

Summarize what this ballot measure does, using ONLY the SOURCE TEXT below. The source text was fetched from real, public information about the measure.

Hard rules:
- Use ONLY facts present in the SOURCE TEXT. Do not use any outside knowledge.
- If the SOURCE TEXT does not actually describe what the measure does (e.g. it is only a title, navigation, or boilerplate), reply with exactly: ${INSUFFICIENT}
- Stay neutral — present facts, not opinions. Do not advocate for or against.
- 2-4 sentences. Explain what changes if it passes (and the cost/tax, if stated).
- Plain English, no legal jargon. Do not repeat the title verbatim.

MEASURE TITLE: ${title}

SOURCE TEXT:
"""
${groundingText.slice(0, 6000)}
"""

Return only the summary text, or exactly ${INSUFFICIENT}.`;

  const { text } = await generateText({
    model: llm,
    temperature: 0.2,
    prompt,
  });
  const out = text.trim();
  if (!out || out.toUpperCase().includes(INSUFFICIENT)) {
    throw new Error("model judged source text insufficient");
  }
  return out;
}
