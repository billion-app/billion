import type { LanguageModel, LanguageModelMiddleware, Tool } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { customProvider, generateText, wrapLanguageModel } from "ai";

import { createLogger } from "../log.js";

const logger = createLogger("ai-provider");

let textLlm: LanguageModel | null = null;
let structuredLlm: LanguageModel | null = null;
let openrouterProvider: ReturnType<typeof createOpenRouter> | null = null;
let localProvider: ReturnType<typeof createOpenAICompatible> | null = null;

const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-v4-flash";
const DEFAULT_LOCAL_MODEL = "billion-scraper:latest";
export const DEEPSEEK_VISION_MODEL = "deepseek-v4-flash-vision-exp";

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

export interface LocalLlmConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

export function getLocalLlmConfig(): LocalLlmConfig | null {
  const baseURL = getLocalBaseUrl();
  if (!baseURL) return null;
  return {
    baseURL,
    model: getLocalModel(),
    apiKey: process.env.LOCAL_LLM_API_KEY?.trim() || "ollama",
  };
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
          local: { think: false, reasoningEffort: "none" },
        },
      }),
    },
  });
}

/** The proxy owns OAuth credentials; scraper processes only know its URL. */
function getFallbackProvider() {
  const baseURL = process.env.SCRAPER_FALLBACK_BASE_URL?.trim().replace(
    /\/$/,
    "",
  );
  return baseURL
    ? createOpenAI({
        baseURL,
        apiKey: process.env.SCRAPER_FALLBACK_API_KEY?.trim() || "unused",
      })
    : null;
}

function getFallbackModel(): V3Model | null {
  const provider = getFallbackProvider();
  if (!provider) return null;
  return wrapLanguageModel({
    model: customProvider({ fallbackProvider: provider }).languageModel(
      process.env.SCRAPER_FALLBACK_MODEL?.trim() || "gpt-6-luna",
    ),
    middleware: {
      specificationVersion: "v3",
      transformParams: async ({ params }) => ({
        ...params,
        // AI SDK v6 adapts model results but forwards input tools unchanged.
        // The v2 OpenAI provider expects the historical native-tool tag.
        tools: params.tools?.map((tool) =>
          tool.type === "provider"
            ? { ...tool, type: "provider-defined" }
            : tool,
        ) as typeof params.tools,
        providerOptions: {
          ...params.providerOptions,
          openai: {
            store: false,
            reasoningEffort: "none",
            strictJsonSchema: false,
          },
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
        if (params.abortSignal?.aborted) throw primaryError;
        let lastError: unknown = primaryError;
        for (const fallback of fallbacks) {
          logger.warn(
            `${primary.label} text generation failed; trying ${fallback.label}`,
          );
          try {
            return await fallback.model.doGenerate(params);
          } catch (error) {
            if (params.abortSignal?.aborted) throw error;
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
        if (params.abortSignal?.aborted) throw primaryError;
        let lastError: unknown = primaryError;
        for (const fallback of fallbacks) {
          logger.warn(
            `${primary.label} text stream failed; trying ${fallback.label}`,
          );
          try {
            return await fallback.model.doStream(params);
          } catch (error) {
            if (params.abortSignal?.aborted) throw error;
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
 * an AI key. An OpenAI-compatible local server (such as Ollama) is preferred
 * because it costs nothing, OpenRouter is the fallback for when it is down or
 * unconfigured, and direct DeepSeek remains deprecated.
 */
export function getTextLlm(): LanguageModel {
  if (textLlm) return textLlm;

  const candidates: { label: string; model: V3Model }[] = [];
  const localBaseUrl = getLocalBaseUrl();
  if (localBaseUrl) {
    candidates.push({
      label: "local LLM",
      model: getLocalTextModel(localBaseUrl),
    });
  }

  const openrouterKey = getOpenRouterApiKey();
  if (openrouterKey) {
    candidates.push({
      label: "OpenRouter",
      model: getOpenRouterProvider(openrouterKey).chat(getOpenRouterModel()),
    });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (candidates.length === 0 && deepseekKey) {
    candidates.push({
      label: "DeepSeek",
      model: customProvider({
        fallbackProvider: createDeepSeek({ apiKey: deepseekKey }),
      }).languageModel("deepseek-v4-flash"),
    });
  }
  const fallback = getFallbackModel();
  if (fallback)
    candidates.push({ label: "configured fallback", model: fallback });
  textLlm = withFallbacks(candidates);
  return textLlm;
}

export interface StructuredLlmCandidate {
  model: V3Model;
  modelVersion: string;
}

/**
 * Return structured-output providers separately so callers can retry another
 * provider without losing the model provenance stored with generated content.
 * Hosted providers retain their historical priority unless a caller has
 * explicitly validated its workload against the configured local model.
 */
export function getStructuredLlmCandidates(options?: {
  localFirst?: boolean;
}): StructuredLlmCandidate[] {
  const localBaseUrl = getLocalBaseUrl();
  const local: StructuredLlmCandidate | null = localBaseUrl
    ? {
        model: getLocalTextModel(localBaseUrl),
        modelVersion: `local:${getLocalModel()}`,
      }
    : null;
  const openrouterKey = getOpenRouterApiKey();
  const openrouter: StructuredLlmCandidate | null = openrouterKey
    ? {
        model: getOpenRouterProvider(openrouterKey).chat(getOpenRouterModel()),
        modelVersion: `openrouter:${getOpenRouterModel()}`,
      }
    : null;
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  const deepseek: StructuredLlmCandidate | null = deepseekKey
    ? {
        model: customProvider({
          fallbackProvider: createDeepSeek({ apiKey: deepseekKey }),
        }).languageModel("deepseek-v4-flash"),
        modelVersion: "deepseek:deepseek-v4-flash",
      }
    : null;
  const candidates = options?.localFirst
    ? [local, openrouter, deepseek]
    : [openrouter, deepseek, local];
  const configured = candidates.filter(
    (candidate): candidate is StructuredLlmCandidate => candidate !== null,
  );
  const fallback = getFallbackModel();
  if (fallback)
    configured.push({
      model: fallback,
      modelVersion: `fallback:${process.env.SCRAPER_FALLBACK_MODEL?.trim() || "gpt-6-luna"}`,
    });
  if (configured.length === 0) {
    throw new Error("No scraper text provider is configured");
  }
  return configured;
}

/** Resolve the historical hosted-first structured-output default. */
export function getStructuredLlm(): LanguageModel {
  structuredLlm ??= withFallbacks(
    getStructuredLlmCandidates().map((candidate) => ({
      label: candidate.modelVersion,
      model: candidate.model,
    })),
  );
  return structuredLlm;
}

/**
 * Provider-qualified model identifier recorded with generated content.
 *
 * The order here is deliberately frozen and no longer tracks `getTextLlm()`'s
 * preference order: this string is part of the dual-lens cache key, so
 * reordering it invalidates every cached lens and pays for a fresh agentic
 * research loop that can only come back the same or worse. Add a provider here
 * only when the set of configured providers actually changes.
 */
export function getTextModelVersion(): string {
  const modernProviders = [
    getOpenRouterApiKey() && `openrouter:${getOpenRouterModel()}`,
    getLocalBaseUrl() && `local:${getLocalModel()}`,
  ]
    .filter(Boolean)
    .join(" -> ");
  // An outage fallback does not invalidate existing lens research caches.
  if (modernProviders) return modernProviders;
  if (process.env.DEEPSEEK_API_KEY?.trim()) return "deepseek:deepseek-v4-flash";
  if (getFallbackProvider())
    return `fallback:${process.env.SCRAPER_FALLBACK_MODEL?.trim() || "gpt-6-luna"}`;
  return "deepseek:deepseek-v4-flash";
}

/** Actual model selected for structured output, independent of the lens cache key. */
export function getStructuredModelVersion(): string {
  return getStructuredLlmCandidates()[0]!.modelVersion;
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

export function getDeepSeekVisionApiKey(): string {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      `DEEPSEEK_API_KEY is required for ${DEEPSEEK_VISION_MODEL} image review`,
    );
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
/** Retry search with the fallback's own native tool so citations survive. */
export async function generateWebSearch(prompt: string) {
  try {
    return await generateText({
      model: getSearchModel(),
      tools: { web_search: getWebSearchTool() as Tool<any, any> },
      prompt,
      ...(getFallbackProvider() ? { maxRetries: 0 } : {}),
    });
  } catch (error) {
    const provider = getFallbackProvider();
    const model = getFallbackModel();
    if (!provider || !model) throw error;
    logger.warn("Primary web search failed; trying configured fallback");
    const result = await generateText({
      model,
      tools: {
        // OpenAI SDK v2 names this discriminator provider-defined; AI SDK v6
        // accepts provider; model middleware maps it back at the boundary.
        web_search: {
          ...provider.tools.webSearchPreview({ searchContextSize: "low" }),
          type: "provider",
        } as Tool<any, any>,
      },
      prompt,
      maxRetries: 0,
    });
    if (!result.sources.some((source) => source.sourceType === "url")) {
      throw new Error(
        "Configured fallback returned no web-search citations; the endpoint may not support native search",
      );
    }
    return result;
  }
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
