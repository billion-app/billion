import type { LanguageModel } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";

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

// Keep Vertex for Imagen image generation
const project = process.env.GOOGLE_VERTEX_PROJECT;
const location = process.env.GOOGLE_VERTEX_LOCATION;
const apiKey = process.env.GOOGLE_VERTEX_API_KEY;

export const vertexProvider = createVertex({
  ...(project ? { project } : {}),
  ...(location ? { location } : {}),
  ...(apiKey ? { apiKey } : {}),
});
