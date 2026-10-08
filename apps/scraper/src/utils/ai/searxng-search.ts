import { z } from "zod";

const responseSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      content: z.string().optional(),
    }),
  ),
  unresponsive_engines: z.array(z.unknown()).optional(),
});

/** SearXNG discovers URLs; page retrieval and citation validation remain ours. */
async function requestSearch(query: string, baseUrl: string) {
  const endpoint = new URL("search", `${baseUrl.replace(/\/$/, "")}/`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      q: query,
      format: "json",
      language: "en",
      categories: "general",
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok)
    throw new Error(`SearXNG search failed (HTTP ${response.status})`);
  const data = responseSchema.parse(await response.json());
  if (!data.results.length && data.unresponsive_engines?.length)
    throw new Error(
      "SearXNG returned no results while upstream engines were unavailable",
    );
  const results = data.results
    .filter((r) => {
      try {
        const url = new URL(r.url);
        return (
          ["http:", "https:"].includes(url.protocol) &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    })
    .slice(0, 5);
  return {
    text: results
      .map((r) => `${r.title}\n${r.url}\n${r.content ?? ""}`)
      .join("\n\n")
      .slice(0, 1500),
    sources: results.map((r, i) => ({
      sourceType: "url" as const,
      id: `searxng-${i}`,
      title: r.title,
      url: r.url,
    })),
    usage: { inputTokens: 0, outputTokens: 0 },
  };
}

// Background jobs can wait: serialize discovery and leave two seconds between starts.
let queue: Promise<void> = Promise.resolve();
let lastStarted = 0;
export function searchSearxng(query: string, baseUrl: string) {
  const result = queue.then(async () => {
    const delay = Math.max(0, 2000 - (Date.now() - lastStarted));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastStarted = Date.now();
    return requestSearch(query, baseUrl);
  });
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
