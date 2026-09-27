/** Read history is device-local and separate from bookmarks. */
export const READ_CONTENT_KEY = "billion.read-content.v2";
export const LEGACY_READ_CONTENT_KEY = "billion.read-content.v1";
export const READ_VISIBILITY_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ReadReceipt {
  id: string;
  firstReadAt: number;
}

interface ReadStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function parseReadHistory(
  raw: string | null,
  legacyReadAt = Date.now(),
): ReadReceipt[] {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!Array.isArray(value)) return [];

    const byId = new Map<string, ReadReceipt>();
    for (const entry of value as unknown[]) {
      const receipt =
        typeof entry === "string"
          ? { id: entry, firstReadAt: legacyReadAt }
          : typeof entry === "object" &&
              entry !== null &&
              "id" in entry &&
              typeof entry.id === "string" &&
              "firstReadAt" in entry &&
              typeof entry.firstReadAt === "number" &&
              Number.isFinite(entry.firstReadAt) &&
              entry.firstReadAt >= 0
            ? { id: entry.id, firstReadAt: entry.firstReadAt }
            : undefined;
      if (!receipt || byId.has(receipt.id)) continue;
      byId.set(receipt.id, receipt);
    }
    return [...byId.values()];
  } catch {
    return [];
  }
}

/** Serialize writes so opening two articles cannot lose either first-read time. */
export function createReadContentStore(
  storage: ReadStorage,
  now: () => number = Date.now,
) {
  let loaded: Promise<ReadReceipt[]> | undefined;
  let writes = Promise.resolve<ReadReceipt[]>([]);
  const read = () => {
    loaded ??= storage
      .getItem(READ_CONTENT_KEY)
      .then(async (raw) => {
        if (raw !== null) return parseReadHistory(raw);

        const legacyRaw = await storage.getItem(LEGACY_READ_CONTENT_KEY);
        if (legacyRaw === null) return [];
        const legacy = parseReadHistory(legacyRaw, now());
        if (legacy.length > 0) {
          try {
            await storage.setItem(READ_CONTENT_KEY, JSON.stringify(legacy));
          } catch {
            // Retain migrated history for this session if storage is full.
          }
        }
        return legacy;
      })
      .catch(() => []);
    return loaded;
  };
  const markRead = (id: string) => {
    writes = writes.then(async () => {
      const current = await read();
      if (current.some((receipt) => receipt.id === id)) return current;
      const next = [...current, { id, firstReadAt: now() }];
      loaded = Promise.resolve(next);
      try {
        await storage.setItem(READ_CONTENT_KEY, JSON.stringify(next));
      } catch {
        // Retain history for this session if device storage is unavailable.
      }
      return next;
    });
    return writes;
  };
  return { read, markRead };
}

/** Keep editorial order, dedupe cards, and delay hiding reads for 24 hours. */
export function visibleArticles<T extends { id: string }>(
  articles: readonly T[],
  readHistory: readonly ReadReceipt[],
  now = Date.now(),
): T[] {
  const hiddenIds = new Set(
    readHistory
      .filter(
        ({ firstReadAt }) => now - firstReadAt >= READ_VISIBILITY_WINDOW_MS,
      )
      .map(({ id }) => id),
  );
  const seen = new Set<string>();
  return articles.filter((article) => {
    if (hiddenIds.has(article.id) || seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  });
}
