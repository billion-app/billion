import type { LanguageModel, LanguageModelMiddleware } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { wrapLanguageModel } from "ai";

import { createLogger } from "../log.js";

const logger = createLogger("ai-provider");

let textLlm: LanguageModel | null = null;
let openrouterProvider: ReturnType<typeof createOpenRouter> | null = null;
let localProvider: ReturnType<typeof createOpenAICompatible> | null = null;

const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-v4-flash";
const DEFAULT_LOCAL_MODEL = "billion-scraper:latest";

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

function getLocalBaseUrl(): string | null {
  const baseUrl = process.env.LOCAL_LLM_BASE_URL?.trim().replace(/\/$/, "");
  return baseUrl || null;
}

function getLocalModel(): string {
  return process.env.LOCAL_LLM_MODEL?.trim() || DEFAULT_LOCAL_MODEL;
}

function getLocalProvider(baseURL: string) {
  localProvider ??= createOpenAICompatible({
    name: "local",
    baseURL,
    // Ollama requires the header for OpenAI compatibility but ignores its value.
    apiKey: process.env.LOCAL_LLM_API_KEY?.trim() || "ollama",
    includeUsage: true,
    supportsStructuredOutputs: true,
  });
  return localProvider;
}

function getLocalTextModel(baseURL: string): V3Model {
  return wrapLanguageModel({
    model: getLocalProvider(baseURL)(getLocalModel()),
    middleware: {
      specificationVersion: "v3",
      transformParams: async ({ params }) => ({
        ...params,
        providerOptions: {
          ...params.providerOptions,
          local: { think: false },
        },
      }),
    },
  });
}

type V3Model = Parameters<typeof wrapLanguageModel>[0]["model"];

function withFallbacks(
  candidates: { label: string; model: V3Model }[],
): LanguageModel {
  const [primary, ...fallbacks] = candidates;
  if (!primary) throw new Error("No scraper text provider is configured");
  if (fallbacks.length === 0) return primary.model;

  const middleware: LanguageModelMiddleware = {
    specificationVersion: "v3",
    wrapGenerate: async ({ doGenerate, params }) => {
      try {
        return await doGenerate();
      } catch (primaryError) {
        let lastError: unknown = primaryError;
        for (const fallback of fallbacks) {
          logger.warn(
            `${primary.label} text generation failed; trying ${fallback.label}`,
          );
          try {
            return await fallback.model.doGenerate(params);
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError;
      }
    },
    wrapStream: async ({ doStream, params }) => {
      try {
        return await doStream();
      } catch (primaryError) {
        let lastError: unknown = primaryError;
        for (const fallback of fallbacks) {
          logger.warn(
            `${primary.label} text stream failed; trying ${fallback.label}`,
          );
          try {
            return await fallback.model.doStream(params);
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError;
      }
    },
  };

  return wrapLanguageModel({ model: primary.model, middleware });
}

/**
 * Resolve the text model lazily so keyless/cache-only scrapers can load without
 * an AI key. OpenRouter is preferred, an OpenAI-compatible local server (such
 * as Ollama) is the keyless fallback, and direct DeepSeek remains deprecated.
 */
export function getTextLlm(): LanguageModel {
  if (textLlm) return textLlm;

  const candidates: { label: string; model: V3Model }[] = [];
  const openrouterKey = getOpenRouterApiKey();
  if (openrouterKey) {
    candidates.push({
      label: "OpenRouter",
      model: getOpenRouterProvider(openrouterKey).chat(getOpenRouterModel()),
    });
  }

  const localBaseUrl = getLocalBaseUrl();
  if (localBaseUrl) {
    candidates.push({
      label: "local LLM",
      model: getLocalTextModel(localBaseUrl),
    });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (candidates.length > 0) {
    textLlm = withFallbacks(candidates);
    return textLlm;
  }
  if (!deepseekKey) {
    throw new Error(
      "OPENROUTER_API_KEY, LOCAL_LLM_BASE_URL, or deprecated DEEPSEEK_API_KEY is required for scraper AI generation",
    );
  }

  textLlm = createDeepSeek({ apiKey: deepseekKey })("deepseek-v4-flash");
  return textLlm;
}

/** Provider-qualified model identifier recorded with generated content. */
export function getTextModelVersion(): string {
  const modernProviders = [
    getOpenRouterApiKey() && `openrouter:${getOpenRouterModel()}`,
    getLocalBaseUrl() && `local:${getLocalModel()}`,
  ]
    .filter(Boolean)
    .join(" -> ");
  return modernProviders || "deepseek:deepseek-v4-flash";
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
