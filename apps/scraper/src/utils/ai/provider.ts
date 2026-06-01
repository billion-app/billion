import { createDeepSeek } from "@ai-sdk/deepseek";
import { createVertex } from "@ai-sdk/google-vertex";

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

if (!deepseekApiKey) {
  throw new Error("DEEPSEEK_API_KEY environment variable is required");
}

const deepseekProvider = createDeepSeek({
  apiKey: deepseekApiKey,
});

export const llm = deepseekProvider("deepseek-v4-flash");

// Keep Vertex for Imagen image generation
const project = process.env.GOOGLE_VERTEX_PROJECT;
const location = process.env.GOOGLE_VERTEX_LOCATION;
const apiKey = process.env.GOOGLE_VERTEX_API_KEY;

export const vertexProvider = createVertex({
  ...(project ? { project } : {}),
  ...(location ? { location } : {}),
  ...(apiKey ? { apiKey } : {}),
});
