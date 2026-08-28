/**
 * The reader's saved set, kept on the device.
 *
 * Saving deliberately does not require an account. Bookmarking something you
 * want to come back to is not a social act and shouldn't cost a sign-up — and
 * account creation isn't built yet, so a server-backed bookmark would mean no
 * bookmarks at all.
 *
 * Stored as an ordered list rather than a set: the order is save order, which
 * is what the saved list renders by. Newest first.
 *
 * The list rules are pure functions so they can be tested without a device;
 * the exported async pair is the thin layer that puts them on disk.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Versioned so a future change to the stored shape can be migrated — or
 * ignored — rather than mis-parsed. Bump the suffix, never reuse it.
 */
const STORAGE_KEY = "billion.saved-content.v1";

/** Bounded so the list stays hydratable in a single request. */
export const MAX_SAVED = 200;

/* ---------- the rules ---------- */

/**
 * Saved ids out of whatever was on disk.
 *
 * Anything unreadable reads as "nothing saved" rather than throwing: a corrupt
 * bookmark list must not stop the app from opening.
 */
export function parseSavedIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.every((value) => typeof value === "string") ? parsed : [];
  } catch {
    return [];
  }
}

/** Puts `contentId` at the front. A repeat save moves it; it does not double. */
export function withSavedId(ids: readonly string[], contentId: string) {
  return [contentId, ...ids.filter((id) => id !== contentId)].slice(
    0,
    MAX_SAVED,
  );
}

export function withoutSavedId(ids: readonly string[], contentId: string) {
  return ids.filter((id) => id !== contentId);
}

/* ---------- the disk ---------- */

export interface SavedStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/**
 * One ordered saved-set transaction log.
 *
 * AsyncStorage has no compare-and-swap operation. Serializing the whole
 * read/transform/write sequence is therefore the only way to stop two quick
 * taps from reading the same old array and overwriting each other. The cached
 * value also keeps this session internally consistent if a disk write fails.
 */
export function createSavedStore(storage: SavedStorage) {
  let loaded: Promise<string[]> | undefined;
  let updates = Promise.resolve();

  const read = (): Promise<string[]> => {
    loaded ??= storage
      .getItem(STORAGE_KEY)
      .then(parseSavedIds)
      .catch(() => []);
    return loaded;
  };

  const update = async (
    transform: (current: readonly string[]) => string[],
  ): Promise<string[]> => {
    let committed: string[] = [];
    const operation = updates.then(async () => {
      committed = transform(await read());
      loaded = Promise.resolve(committed);
      try {
        await storage.setItem(STORAGE_KEY, JSON.stringify(committed));
      } catch {
        // Keep the in-memory value. The bookmark remains correct for this
        // session even if the device cannot persist it across a restart.
      }
      return committed;
    });

    // A failed adapter must not poison every later update in the queue.
    updates = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  };

  return {
    read,
    add: (contentId: string) =>
      update((current) => withSavedId(current, contentId)),
    remove: (contentId: string) =>
      update((current) => withoutSavedId(current, contentId)),
    set: (contentId: string, saved: boolean) =>
      update((current) =>
        saved
          ? withSavedId(current, contentId)
          : withoutSavedId(current, contentId),
      ),
  };
}

const savedStore = createSavedStore(AsyncStorage);

export const readSavedIds = savedStore.read;
export const addSavedId = savedStore.add;
export const removeSavedId = savedStore.remove;
export const setSavedId = savedStore.set;
