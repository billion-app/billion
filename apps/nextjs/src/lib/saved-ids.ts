import { z } from "zod/v4";

/**
 * Which saved ids the saved page can load, and which it could not find.
 *
 * `content.byIds` validates every id with `z.uuid()` and rejects the whole
 * request for a single bad one, so the client uses the same schema rather
 * than a looser regex. A malformed id can never load and is safe to forget.
 * An id the server simply did not return is different: the record may be
 * gone for good or missing for a moment (a re-scrape, a restore), so the
 * reader decides whether to remove it — the page never deletes it on its own.
 */
const LoadableId = z.string().uuid();

export function isLoadableId(id: string): boolean {
  return LoadableId.safeParse(id).success;
}

export function splitSaved(
  ids: readonly string[],
  returned: ReadonlySet<string> | null,
) {
  const loadable = ids.filter(isLoadableId);
  return {
    loadable,
    malformed: ids.filter((id) => !isLoadableId(id)),
    missing: returned ? loadable.filter((id) => !returned.has(id)) : [],
  };
}
