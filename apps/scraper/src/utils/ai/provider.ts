import { createVertex } from "@ai-sdk/google-vertex";

const project = process.env.GOOGLE_VERTEX_PROJECT;
const location = process.env.GOOGLE_VERTEX_LOCATION;
const apiKey = process.env.GOOGLE_VERTEX_API_KEY;

export const vertexProvider = createVertex({
  ...(project ? { project } : {}),
  ...(location ? { location } : {}),
  ...(apiKey ? { apiKey } : {}),
});

