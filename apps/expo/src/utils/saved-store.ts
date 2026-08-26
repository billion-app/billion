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

export async function readSavedIds(): Promise<string[]> {
  try {
    return parseSavedIds(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

async function write(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Out of space, or storage unavailable. The set the UI is reading stays
    // correct for this session; the bookmark just will not survive a restart,
    // which is better than surfacing a write error on a tap.
  }
}

/** Adds `contentId` and returns the list that was committed. */
export async function addSavedId(contentId: string): Promise<string[]> {
  const next = withSavedId(await readSavedIds(), contentId);
  await write(next);
  return next;
}

export async function removeSavedId(contentId: string): Promise<string[]> {
  const next = withoutSavedId(await readSavedIds(), contentId);
  await write(next);
  return next;
}
