import type { LanguageModel } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

if (!deepseekApiKey) {
  throw new Error("DEEPSEEK_API_KEY environment variable is required");
}

const deepseekProvider = createDeepSeek({
  apiKey: deepseekApiKey,
});

export const llm = deepseekProvider("deepseek-v4-flash");

// Multimodal (PDF/vision) model for document extraction — DeepSeek is text-only.
// Gated on the API key so the scraper still runs without it (callers that need
// multimodal extraction must null-check and skip when this is null).
const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
export const visionLlm: LanguageModel | null = googleApiKey
  ? createGoogleGenerativeAI({ apiKey: googleApiKey })("gemini-2.5-flash")
  : null;

// Image generation uses Black Forest Labs FLUX.2 Pro via its own REST API
// (see ai/image-generation.ts) — no AI SDK provider needed.
