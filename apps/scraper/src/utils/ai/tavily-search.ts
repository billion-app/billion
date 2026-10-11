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
async function requestSearch(query: string, apiKey: string) {
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

export class TavilyBudgetError extends Error {}

/** One instance per scraper process, shared by all concurrent research loops. */
export function createTavilySearch() {
  const cache = new Map<
    string,
    Promise<Awaited<ReturnType<typeof requestSearch>>>
  >();
  let allowance: Promise<number> | undefined;
  let attempted = 0;
  let stopped: Error | undefined;

  const limit = (name: string, fallback: number) => {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 0)
      throw new TavilyBudgetError(`${name} must be a nonnegative integer`);
    return value;
  };

  return (query: string, apiKey: string) => {
    const key = query.trim().replace(/\s+/g, " ");
    const cached = cache.get(key);
    if (cached) return cached;
    const result = (async () => {
      if (stopped) throw stopped;
      const runLimit = limit("SCRAPER_TAVILY_MAX_SEARCHES_PER_RUN", 10);
      if (attempted >= runLimit)
        throw new TavilyBudgetError(
          `Tavily run budget reached (${runLimit} searches)`,
        );
      allowance ??= (async () => {
        const monthlyLimit = limit("SCRAPER_TAVILY_MONTHLY_CREDIT_LIMIT", 800);
        if (!monthlyLimit || !runLimit) return 0;
        const response = await fetch("https://api.tavily.com/usage", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok)
          throw new TavilyBudgetError(
            `Tavily usage check failed (HTTP ${response.status}); search stopped`,
          );
        const usage = z
          .object({
            key: z.object({
              usage: z.number().nonnegative(),
              limit: z.number().nonnegative().nullable(),
            }),
            account: z.object({
              plan_usage: z.number().nonnegative(),
              plan_limit: z.number().nonnegative(),
            }),
          })
          .parse(await response.json());
        return Math.max(
          0,
          Math.min(
            monthlyLimit - usage.account.plan_usage,
            usage.account.plan_limit - usage.account.plan_usage,
            usage.key.limit === null
              ? Infinity
              : usage.key.limit - usage.key.usage,
          ),
        );
      })();
      let available: number;
      try {
        available = await allowance;
      } catch (error) {
        throw new TavilyBudgetError(
          `Tavily usage could not be verified; search stopped (${error instanceof Error ? error.message : "invalid response"})`,
        );
      }
      // Reserve synchronously after the shared usage read, before sending HTTP.
      if (attempted >= Math.min(runLimit, available))
        throw new TavilyBudgetError(
          "Tavily credit budget reached; search stopped",
        );
      attempted++;
      try {
        return await requestSearch(key, apiKey);
      } catch (error) {
        if (error instanceof Error && /HTTP (401|432|433)/.test(error.message))
          stopped = new TavilyBudgetError(error.message);
        throw stopped ?? error;
      }
    })();
    cache.set(key, result);
    void result.catch(() => cache.delete(key));
    return result;
  };
}
