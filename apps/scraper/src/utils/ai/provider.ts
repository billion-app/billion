import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

let textLlm: LanguageModel | null = null;
let openrouterProvider: ReturnType<typeof createOpenRouter> | null = null;

const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-v4-flash";

function getOpenRouterApiKey(): string | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  return apiKey;
}

function getOpenRouterModel(): string {
  const model = process.env.OPENROUTER_MODEL?.trim();
  if (!model) return DEFAULT_OPENROUTER_MODEL;
  return model;
}

function getOpenRouterProvider(apiKey: string) {
  openrouterProvider ??= createOpenRouter({ apiKey });
  return openrouterProvider;
}

/**
 * Resolve the text model lazily so keyless/cache-only scrapers can load without
 * an AI key. OpenRouter is preferred; direct DeepSeek is a deprecated fallback
 * so existing deployments can migrate without downtime. The CLI validates that
 * one of these keys exists before running a scraper that needs text generation.
 */
export function getTextLlm(): LanguageModel {
  if (textLlm) return textLlm;

  const openrouterKey = getOpenRouterApiKey();
  if (openrouterKey) {
    textLlm = getOpenRouterProvider(openrouterKey).chat(getOpenRouterModel());
    return textLlm;
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!deepseekKey) {
    throw new Error(
      "OPENROUTER_API_KEY or deprecated DEEPSEEK_API_KEY is required for scraper AI generation",
    );
  }

  textLlm = createDeepSeek({ apiKey: deepseekKey })("deepseek-v4-flash");
  return textLlm;
}

/** Provider-qualified model identifier recorded with generated content. */
export function getTextModelVersion(): string {
  return getOpenRouterApiKey()
    ? `openrouter:${getOpenRouterModel()}`
    : "deepseek:deepseek-v4-flash";
}

// The deprecated direct-DeepSeek fallback uses its Anthropic-compatible
// endpoint for native web search. OpenRouter exposes an equivalent provider
// server tool through its AI SDK integration.
function getDeepSeekApiKey(): string {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required for scraper AI generation");
  }
  return apiKey;
}

/** Search-capable model matching the active text provider. */
export function getSearchModel(): LanguageModel {
  const openrouterKey = getOpenRouterApiKey();
  if (openrouterKey) {
    return getOpenRouterProvider(openrouterKey).chat(getOpenRouterModel());
  }
  return createAnthropic({
    baseURL: "https://api.deepseek.com/anthropic",
    apiKey: getDeepSeekApiKey(),
  })("deepseek-v4-flash");
}

/** Provider-native web-search server tool with bounded results/usage. */
export function getWebSearchTool() {
  const openrouterKey = getOpenRouterApiKey();
  if (openrouterKey) {
    return getOpenRouterProvider(openrouterKey).tools.webSearch({
      maxResults: 5,
    });
  }
  const provider = createAnthropic({
    baseURL: "https://api.deepseek.com/anthropic",
    apiKey: getDeepSeekApiKey(),
  });
  return provider.tools.webSearch_20250305({ maxUses: 5 });
}
// Multimodal (PDF/vision) model for document extraction — the default text
// model is text-only.
// Gated on the API key so the scraper still runs without it (callers that need
// multimodal extraction must null-check and skip when this is null).
const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
export const visionLlm: LanguageModel | null = googleApiKey
  ? createGoogleGenerativeAI({ apiKey: googleApiKey })("gemini-2.5-flash")
  : null;

// Image generation uses Black Forest Labs FLUX.2 Klein 9B via its own REST API
// (see ai/image-generation.ts) — no AI SDK provider needed.
