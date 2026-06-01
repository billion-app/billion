/**
 * Generic LLM provider for civic text generation.
 *
 * Mirrors the scraper's `llm` pattern (apps/scraper/src/utils/ai/provider.ts):
 * a single `llm` model exported through the Vercel AI SDK so the provider can
 * be swapped without touching call sites. DeepSeek is the default (matches the
 * scraper); OpenAI is used as a fallback when only that key is present.
 *
 * `llm` is `null` when no provider key is configured — callers must treat that
 * as "AI unavailable" and skip generation rather than throw.
 */

import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

function resolveModel(): LanguageModel | null {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    return createDeepSeek({ apiKey: deepseekKey })("deepseek-v4-flash");
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return createOpenAI({ apiKey: openaiKey })("gpt-4o-mini");
  }
  return null;
}

/** The active LLM, or null when no provider key is set. */
export const llm: LanguageModel | null = resolveModel();

/** True when an AI provider is configured and text generation is possible. */
export function aiAvailable(): boolean {
  return llm !== null;
}
