import type { LanguageModel } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

if (!deepseekApiKey) {
  throw new Error("DEEPSEEK_API_KEY environment variable is required");
}

const deepseekProvider = createDeepSeek({
  apiKey: deepseekApiKey,
});

export const llm = deepseekProvider("deepseek-v4-flash");

// DeepSeek's Anthropic-compatible endpoint exposes the native server-side
// `web_search` tool (the OpenAI-compatible `llm` above does not). Same
// DEEPSEEK_API_KEY, no third-party search service. Used for the dual-lens
// agentic web research step (see ai/text-generation.ts). The @ai-sdk/anthropic
// major is pinned to the v3/provider-v3 line to match the rest of the SDK.
const deepseekAnthropic = createAnthropic({
  baseURL: "https://api.deepseek.com/anthropic",
  apiKey: deepseekApiKey,
});

/** DeepSeek model that supports the native web_search server tool. */
export const searchModel = deepseekAnthropic("deepseek-v4-flash");

/** Native web-search server tool (bounded by maxUses). */
export const webSearchTool = deepseekAnthropic.tools.webSearch_20250305({
  maxUses: 5,
});

// Multimodal (PDF/vision) model for document extraction — DeepSeek is text-only.
// Gated on the API key so the scraper still runs without it (callers that need
// multimodal extraction must null-check and skip when this is null).
const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
export const visionLlm: LanguageModel | null = googleApiKey
  ? createGoogleGenerativeAI({ apiKey: googleApiKey })("gemini-2.5-flash")
  : null;

// Image generation uses Black Forest Labs FLUX.2 Pro via its own REST API
// (see ai/image-generation.ts) — no AI SDK provider needed.
