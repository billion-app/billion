/** Read history is device-local and separate from bookmarks. */
export const READ_CONTENT_KEY = "billion.read-content.v1";

interface ReadStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function parseReadIds(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    return Array.isArray(value) && value.every((id) => typeof id === "string")
      ? [...new Set<string>(value)]
      : [];
  } catch {
    return [];
  }
}

/** Serialize writes so opening two articles cannot lose either read. */
export function createReadContentStore(storage: ReadStorage) {
  let loaded: Promise<string[]> | undefined;
  let writes = Promise.resolve<string[]>([]);
  const read = () => {
    loaded ??= storage
      .getItem(READ_CONTENT_KEY)
      .then(parseReadIds)
      .catch(() => []);
    return loaded;
  };
  const markRead = (id: string) => {
    writes = writes.then(async () => {
      const current = await read();
      if (current.includes(id)) return current;
      const next = [...current, id];
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

/** Keep editorial order, removing read articles and duplicate cards. */
export function unreadArticles<T extends { id: string }>(
  articles: readonly T[],
  readIds: readonly string[],
): T[] {
  const seen = new Set(readIds);
  return articles.filter((article) => {
    if (seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  });
}
