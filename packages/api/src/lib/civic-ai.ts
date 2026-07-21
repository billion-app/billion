/**
 * AI generation for civic content, via the generic `llm` provider (Groq by
 * default, then OpenRouter, OpenAI, and deprecated direct DeepSeek — see
 * ai-provider.ts).
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

/** A short (one-sentence) and long (paragraph) summary of one measure. */
export interface MeasureSummaries {
  /** One tight sentence for the ballot card. */
  short: string;
  /** 3-4 sentence plain-language explanation for the detail screen. */
  long: string;
}

/**
 * Summarize a ballot measure **from fetched source text only**, at two lengths.
 *
 * @param title         The measure title (for orientation, NOT a content source).
 * @param groundingText Real text fetched from public sources. May include
 *                      advocacy material (e.g. SPUR); callers strip any explicit
 *                      endorsement first, and the prompt instructs the model to
 *                      ignore persuasive framing. Must be substantive — we refuse
 *                      to summarize from a title.
 * @throws if no AI provider is configured, the grounding text is too thin, or
 *         the model judges the source insufficient (so the UI shows "No
 *         information available" rather than a guess).
 */
export async function generateMeasureSummary(
  title: string,
  groundingText: string,
): Promise<MeasureSummaries> {
  if (!llm) throw new Error("no AI provider configured");
  if (groundingText.trim().length < MIN_GROUNDING_CHARS) {
    throw new Error("insufficient grounding text — refusing to summarize");
  }

  const prompt = `You write neutral ballot measure summaries for a voter information app.

Summarize what this ballot measure does, using ONLY the SOURCE TEXT below. The source text was fetched from real, public information about the measure.

Hard rules:
- Use ONLY facts present in the SOURCE TEXT. Do not use any outside knowledge.
- If the SOURCE TEXT does not actually describe what the measure does (e.g. it is only a title, navigation, or boilerplate), reply with exactly: ${INSUFFICIENT}
- The SOURCE TEXT may come from an advocacy or endorsement group. IGNORE any "we recommend", "vote YES/NO", "endorse", or persuasive concluding language; never adopt or reproduce the source's stance. Describe what the measure does, not what anyone thinks of it.
- Stay neutral — present facts, not opinions. Do not advocate for or against.
- Plain English, no legal jargon. Do not repeat the title verbatim.

Produce TWO summaries and return them as a JSON object on a single line:
{"short": "...", "long": "..."}
- "short": ONE sentence capturing the gist (what it does), for a list preview.
- "long": 3-4 sentences explaining what changes if it passes, including the cost/tax and who it affects when the source states them.

MEASURE TITLE: ${title}

SOURCE TEXT:
"""
${groundingText.slice(0, 6000)}
"""

Return only the JSON object, or exactly ${INSUFFICIENT}.`;

  const { text } = await generateText({ model: llm, temperature: 0.2, prompt });
  const out = text.trim();
  if (!out || out.toUpperCase().includes(INSUFFICIENT)) {
    throw new Error("model judged source text insufficient");
  }
  const parsed = parseJsonObject(out);
  const short = typeof parsed?.short === "string" ? parsed.short.trim() : "";
  const long = typeof parsed?.long === "string" ? parsed.long.trim() : "";
  if (!short && !long) {
    // Model ignored the JSON contract — treat the raw text as the long form.
    return { short: firstSentence(out), long: out };
  }
  return { short: short || firstSentence(long), long: long || short };
}

/**
 * Summarize a candidate's own statement of qualifications into plain language,
 * **from the statement text only**.
 *
 * Unlike a ballot measure, the source here is the candidate's self-authored
 * pitch, so we do NOT strip advocacy — we plainly restate what the candidate
 * says about their background and priorities, without endorsing or fact-checking.
 *
 * @param name      The candidate's name (for orientation, NOT a content source).
 * @param statement The verbatim candidate statement. Must be substantive — we
 *                  refuse to summarize from a near-empty statement.
 * @throws if no AI provider is configured, the statement is too thin, or the
 *         model judges the text insufficient.
 */
export async function generateCandidateStatementSummary(
  name: string,
  statement: string,
): Promise<MeasureSummaries> {
  if (!llm) throw new Error("no AI provider configured");
  if (statement.trim().length < MIN_GROUNDING_CHARS) {
    throw new Error("insufficient statement text — refusing to summarize");
  }

  const prompt = `You write plain-language summaries of candidate statements for a voter information app.

Summarize what this candidate says about themselves — their background, qualifications, and priorities — using ONLY the STATEMENT TEXT below. This is the candidate's own statement, written by them.

Hard rules:
- Use ONLY facts present in the STATEMENT TEXT. Do not use any outside knowledge.
- If the STATEMENT TEXT does not actually contain a candidate statement (e.g. it is only a name, heading, or boilerplate), reply with exactly: ${INSUFFICIENT}
- This is the candidate's own pitch — restate what THEY say (their priorities and background). Do NOT fact-check, endorse, oppose, or add your own judgment.
- Attribute claims to the candidate where natural ("they say", "their priorities include") rather than asserting them as fact.
- Plain English, no jargon. Do not repeat the candidate's name verbatim.

Produce TWO summaries and return them as a JSON object on a single line:
{"short": "...", "long": "..."}
- "short": ONE sentence capturing who they are and their top priority, for a list preview.
- "long": 3-4 sentences covering their background and main priorities as stated.

CANDIDATE NAME: ${name}

STATEMENT TEXT:
"""
${statement.slice(0, 6000)}
"""

Return only the JSON object, or exactly ${INSUFFICIENT}.`;

  const { text } = await generateText({ model: llm, temperature: 0.2, prompt });
  const out = text.trim();
  if (!out || out.toUpperCase().includes(INSUFFICIENT)) {
    throw new Error("model judged statement text insufficient");
  }
  const parsed = parseJsonObject(out);
  const short = typeof parsed?.short === "string" ? parsed.short.trim() : "";
  const long = typeof parsed?.long === "string" ? parsed.long.trim() : "";
  if (!short && !long) {
    return { short: firstSentence(out), long: out };
  }
  return { short: short || firstSentence(long), long: long || short };
}

/**
 * Generate neutral pro/con bullet points from fetched source text, used only as
 * a fallback when no source supplied real, human-written arguments.
 *
 * @returns `{ pros, cons }` (each a short list), or null if the model can't
 *          responsibly produce them from the source text.
 */
export async function generateProConFromText(
  title: string,
  groundingText: string,
): Promise<{ pros: string[]; cons: string[] } | null> {
  if (!llm) return null;
  if (groundingText.trim().length < MIN_GROUNDING_CHARS) return null;

  const prompt = `You extract neutral pro/con points for a ballot measure for a voter information app.

Using ONLY the SOURCE TEXT below, list the strongest arguments FOR and AGAINST this measure.

Hard rules:
- Use ONLY points supported by the SOURCE TEXT. Do not invent arguments.
- If the SOURCE TEXT contains no usable arguments, reply with exactly: ${INSUFFICIENT}
- The SOURCE TEXT may come from an advocacy or endorsement group that argues one side harder than the other. Represent both sides proportionally and neutrally; do not inherit the source's lean or reproduce "we recommend / vote YES/NO" language.
- Neutral phrasing. 1-3 concise bullets per side.

Return a JSON object on one line: {"pros": ["..."], "cons": ["..."]}

MEASURE TITLE: ${title}

SOURCE TEXT:
"""
${groundingText.slice(0, 6000)}
"""

Return only the JSON object, or exactly ${INSUFFICIENT}.`;

  try {
    const { text } = await generateText({
      model: llm,
      temperature: 0.2,
      prompt,
    });
    const out = text.trim();
    if (!out || out.toUpperCase().includes(INSUFFICIENT)) return null;
    const parsed = parseJsonObject(out);
    const pros = Array.isArray(parsed?.pros)
      ? parsed.pros.filter((p): p is string => typeof p === "string")
      : [];
    const cons = Array.isArray(parsed?.cons)
      ? parsed.cons.filter((c): c is string => typeof c === "string")
      : [];
    if (!pros.length && !cons.length) return null;
    return { pros, cons };
  } catch {
    return null;
  }
}

/** Parse a JSON object from model output, tolerating surrounding prose/fences. */
function parseJsonObject(s: string): Record<string, unknown> | null {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** First sentence of a paragraph, for deriving a short summary. */
function firstSentence(s: string): string {
  const m = /^[\s\S]*?[.!?](\s|$)/.exec(s.trim());
  return (m ? m[0] : s).trim();
}
