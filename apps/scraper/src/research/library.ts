import { z } from "zod";

import type { ResearchStore, SourceDocument } from "./store.js";
import { canonicalSourceUrl, retrieveSource } from "./pages.js";
import { hash, researchStore } from "./store.js";

export const DAY_MS = 86_400_000;
export const discoverySchema = z.object({
  text: z.string(),
  sources: z.array(
    z.object({
      sourceType: z.literal("url"),
      title: z.string().optional(),
      url: z.string().url(),
    }),
  ),
});
export type Discovery = z.infer<typeof discoverySchema>;

export function createResearchLibrary(options: {
  discover: (query: string) => Promise<Discovery>;
  namespace: string;
  store?: ResearchStore;
  retrieve?: typeof retrieveSource;
  now?: () => Date;
}) {
  const store = options.store ?? researchStore;
  const retrieve = options.retrieve ?? retrieveSource;
  const now = options.now ?? (() => new Date());
  const pending = new Map<string, Promise<unknown>>();
  async function once<T>(key: string, run: () => Promise<T>): Promise<T> {
    const existing = pending.get(key);
    if (existing) return existing as Promise<T>;
    const result = run();
    pending.set(key, result);
    try {
      return await result;
    } finally {
      pending.delete(key);
    }
  }
  const expires = (days = 1) => new Date(now().getTime() + days * DAY_MS);
  return {
    async seed(url: string, title: string, body: string) {
      await store.saveDocument({
        url: canonicalSourceUrl(url),
        title,
        body,
        sourceHash: hash(body),
        fetchedAt: now(),
        expiresAt: expires(7),
      });
    },
    async search(query: string, discover = false): Promise<Discovery> {
      const normalized = query.trim().replace(/\s+/g, " ").slice(0, 500);
      if (!normalized) throw new Error("Research query is empty");
      if (!discover) {
        const documents = await store.find(normalized);
        if (documents.length)
          return {
            text:
              "Previously retrieved source material. Request discover=true if these sources do not cover the evidence gap.\n" +
              documents
                .map(
                  (d) =>
                    `${d.title}\n${d.url}\nRetrieved ${d.fetchedAt.toISOString()}\n${d.body.slice(0, 500)}`,
                )
                .join("\n\n"),
            sources: documents.map((d) => ({
              sourceType: "url",
              title: d.title,
              url: d.url,
            })),
          };
      }
      const key =
        "search:" + hash(JSON.stringify(["v1", options.namespace, normalized]));
      return once(key, async () => {
        const cached = discoverySchema.safeParse(await store.get(key));
        if (cached.success) return cached.data;
        const found = discoverySchema.parse(await options.discover(normalized));
        // Empty results can mean an outage; do not persist them as evidence of absence.
        if (found.sources.length) await store.set(key, found, expires());
        return found;
      });
    },
    async page(value: string): Promise<SourceDocument> {
      const url = canonicalSourceUrl(value);
      return once("page:" + url, async () => {
        const cached = await store.document(url);
        if (cached) return cached;
        const retrieved = await retrieve(url);
        const document = {
          ...retrieved,
          sourceHash: hash(retrieved.body),
          fetchedAt: now(),
          expiresAt: expires(7),
        };
        // Cite the requested URL (also the search result) and retain the final URL separately.
        await store.saveDocument(document);
        if (document.url !== url)
          await store.saveDocument({ ...document, url });
        return { ...document, url };
      });
    },
  };
}
