import type { LanguageModel } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

let textLlm: LanguageModel | null = null;

/**
 * Resolve the text model lazily so keyless/cache-only scrapers can load without
 * DeepSeek. The CLI validates DEEPSEEK_API_KEY before running a scraper that
 * actually needs text generation; this guard also protects standalone callers.
 */
export function getTextLlm(): LanguageModel {
  if (textLlm) return textLlm;

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required for scraper AI generation");
  }

  textLlm = createDeepSeek({ apiKey })("deepseek-v4-flash");
  return textLlm;
}

// DeepSeek's Anthropic-compatible endpoint exposes the native server-side
// `web_search` tool (the OpenAI-compatible `llm` above does not). Same
// DEEPSEEK_API_KEY, no third-party search service. Used for the dual-lens
// agentic web research step (see ai/text-generation.ts). The @ai-sdk/anthropic
// major is pinned to the v3/provider-v3 line to match the rest of the SDK.
function getDeepSeekApiKey(): string {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required for scraper AI generation");
  }
  return apiKey;
}

/** DeepSeek model that supports the native web_search server tool. */
export function getSearchModel(): LanguageModel {
  return createAnthropic({
    baseURL: "https://api.deepseek.com/anthropic",
    apiKey: getDeepSeekApiKey(),
  })("deepseek-v4-flash");
}

/** Native web-search server tool (bounded by maxUses). */
export function getWebSearchTool() {
  const provider = createAnthropic({
    baseURL: "https://api.deepseek.com/anthropic",
    apiKey: getDeepSeekApiKey(),
  });
  return provider.tools.webSearch_20250305({ maxUses: 5 });
}
// Multimodal (PDF/vision) model for document extraction — DeepSeek is text-only.
// Gated on the API key so the scraper still runs without it (callers that need
// multimodal extraction must null-check and skip when this is null).
const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
export const visionLlm: LanguageModel | null = googleApiKey
  ? createGoogleGenerativeAI({ apiKey: googleApiKey })("gemini-2.5-flash")
  : null;

// Image generation uses Black Forest Labs FLUX.2 Klein 9B via its own REST API
// (see ai/image-generation.ts) — no AI SDK provider needed.
