import { z } from "zod";

const searchResponse = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z
        .string()
        .url()
        .refine((url) => /^https?:\/\//i.test(url)),
      content: z.string(),
    }),
  ),
});

/** Basic search uses one credit; return source snippets, never generated answers. */
export async function searchTavily(query: string, apiKey: string) {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      auto_parameters: false,
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    throw new Error(`Tavily search failed (HTTP ${response.status})`);
  const { results } = searchResponse.parse(await response.json());
  const selected = results.slice(0, 5);
  return {
    text: selected
      .map((result) => `${result.title}\n${result.url}\n${result.content}`)
      .join("\n\n")
      .slice(0, 1500),
    sources: selected.map((result, index) => ({
      sourceType: "url" as const,
      id: `tavily-${index}`,
      title: result.title,
      url: result.url,
    })),
    usage: { inputTokens: 0, outputTokens: 0 },
  };
}
