import type { Discovery } from "../research/library.js";
import { createResearchLibrary } from "../research/library.js";

export function createCaliforniaResearchLibrary(
  options: Omit<
    Parameters<typeof createResearchLibrary>[0],
    "namespace" | "discover"
  > & {
    discover: (
      query: string,
      engines?: readonly string[],
    ) => Promise<Discovery>;
  },
  configuration: {
    SCRAPER_SEARCH_PROVIDER?: string;
    SCRAPER_SEARXNG_BASE_URL?: string;
  },
) {
  const engines =
    configuration.SCRAPER_SEARCH_PROVIDER === "searxng"
      ? (["mwmbl"] as const)
      : undefined;
  return createResearchLibrary({
    ...options,
    discover: (query) => options.discover(query, engines),
    namespace: JSON.stringify([
      "california-candidate-research-v2",
      configuration.SCRAPER_SEARCH_PROVIDER ?? "",
      configuration.SCRAPER_SEARXNG_BASE_URL ?? "",
      engines,
      "candidate-name-v1",
    ]),
  });
}
