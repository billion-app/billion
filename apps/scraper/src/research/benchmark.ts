import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

import { searchSearxng } from "../utils/ai/searxng-search.js";
import { searchTavily } from "../utils/ai/tavily-search.js";
import { retrieveSource } from "./pages.js";

const argv = process.argv.slice(2);
const queryPath = argv[0],
  outputPath = argv[1];
if (
  !queryPath ||
  !outputPath ||
  argv.some((arg, index) => index > 1 && arg !== "--tavily")
)
  throw new Error(
    "Usage: search-benchmark <queries.json> <output.json> [--tavily]. At most three queries; --tavily spends at most three basic-search credits. No DB or model calls.",
  );
const queries = z
  .array(
    z.object({
      label: z.string(),
      query: z.string().min(1).max(500),
      expectedTerms: z.array(z.string()).min(1),
    }),
  )
  .min(1)
  .max(3)
  .parse(JSON.parse(await readFile(queryPath, "utf8")));
const baseUrl = process.env.SCRAPER_SEARXNG_BASE_URL;
if (!baseUrl)
  throw new Error(
    "Set SCRAPER_SEARXNG_BASE_URL for the private trial instance",
  );
const compareTavily = argv.includes("--tavily");
if (compareTavily && !process.env.TAVILY_API_KEY)
  throw new Error("--tavily requires TAVILY_API_KEY");
const results: unknown[] = [];
for (const query of queries) {
  for (const provider of compareTavily
    ? (["searxng", "tavily"] as const)
    : (["searxng"] as const)) {
    const start = Date.now();
    try {
      const found =
        provider === "searxng"
          ? await searchSearxng(query.query, baseUrl)
          : await searchTavily(query.query, process.env.TAVILY_API_KEY!);
      const pages: unknown[] = [];
      for (const source of found.sources.slice(0, 2)) {
        try {
          const page = await retrieveSource(source.url);
          const content = `${page.title} ${page.body}`.toLowerCase();
          pages.push({
            url: page.url,
            title: page.title,
            readableCharacters: page.body.length,
            matchedTerms: query.expectedTerms.filter((term) =>
              content.includes(term.toLowerCase()),
            ),
            excerpt: page.body.slice(0, 500),
          });
        } catch (error) {
          pages.push({
            url: source.url,
            error: error instanceof Error ? error.message : "Retrieval failed",
          });
        }
      }
      results.push({
        label: query.label,
        query: query.query,
        provider,
        elapsedMs: Date.now() - start,
        results: found.sources.map(({ title, url }) => ({ title, url })),
        pages,
      });
    } catch (error) {
      results.push({
        label: query.label,
        query: query.query,
        provider,
        elapsedMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Discovery failed",
      });
    }
  }
}
await writeFile(
  outputPath,
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      scope:
        "Bounded discovery/readability trial; keyword matches are not citation-quality or factual-accuracy approval",
      tavilyMaxCredits: compareTavily ? queries.length : 0,
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Saved ${results.length} provider comparisons to ${outputPath}`);
