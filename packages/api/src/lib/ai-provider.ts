/**
 * Generic LLM provider for civic text generation.
 *
 * Mirrors the scraper's `llm` pattern (apps/scraper/src/utils/ai/provider.ts):
 * a single `llm` model exported through the Vercel AI SDK so the provider can
 * be swapped without touching call sites. Groq is the default; OpenRouter and
 * OpenAI are the supported fallbacks. Direct DeepSeek access remains as a
 * deprecated last-resort fallback during the OpenRouter migration.
 *
 * `llm` is `null` when no provider key is configured — callers must treat that
 * as "AI unavailable" and skip generation rather than throw.
 */

import type { LanguageModel } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-v4-flash";

function getOpenRouterModel(): string {
  const model = process.env.OPENROUTER_MODEL?.trim();
  if (!model) return DEFAULT_OPENROUTER_MODEL;
  return model;
}

function resolveModel(): LanguageModel | null {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return createGroq({ apiKey: groqKey })(
      "llama-3.3-70b-versatile",
    ) as unknown as LanguageModel;
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouterKey) {
    return createOpenRouter({ apiKey: openrouterKey }).chat(
      getOpenRouterModel(),
    );
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return createOpenAI({ apiKey: openaiKey })("gpt-4o-mini");
  }

  // Deprecated: keep direct DeepSeek credentials working while deployments
  // migrate to OPENROUTER_API_KEY.
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    return createDeepSeek({ apiKey: deepseekKey })("deepseek-v4-flash");
  }
  return null;
}

/** The active LLM, or null when no provider key is set. */
export const llm: LanguageModel | null = resolveModel();

/** True when an AI provider is configured and text generation is possible. */
export function aiAvailable(): boolean {
  return llm !== null;
}
