import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { posthog } from "~/config/posthog";
import { queryClient } from "~/utils/api";
import {
  readSavedIds,
  setSavedId,
  withoutSavedId,
  withSavedId,
} from "~/utils/saved-store";

/** The content types the saved list can render. */
const SAVEABLE_TYPES = new Set(["bill", "government_content", "court_case"]);

export type SaveableType = "bill" | "government_content" | "court_case";

export function isSaveable(type: string): type is SaveableType {
  return SAVEABLE_TYPES.has(type);
}

export interface SaveTarget {
  id: string;
  type: string;
  title: string;
}

/** Shared by every screen that reads or writes the saved set. */
export const savedIdsQueryKey = ["saved-content-ids"] as const;

// Hook instances live on several screens, but they all write one device set.
// Only the last queued write may reconcile the shared cache; applying an
// earlier completion would briefly erase newer optimistic taps.
let pendingSavedWrites = 0;

/**
 * The reader's saved set, and the one way to change it.
 *
 * Backed by device storage, not an account: bookmarking something to come back
 * to shouldn't cost a sign-up, and sign-up isn't built yet, so a server-backed
 * bookmark would mean no bookmarks at all.
 *
 * Held through React Query so the set is one cache entry shared by every
 * screen — a bill saved on the article page is already filled in when the
 * reader swipes back to Browse — and so a list screen reads it once instead of
 * asking per card.
 */
export function useSavedContent() {
  const { data } = useQuery({
    queryKey: savedIdsQueryKey,
    queryFn: readSavedIds,
    // The device is the source of truth and only this hook writes to it, so
    // the cache is never stale except in the instant between a tap and its
    // write landing — which the optimistic update below already covers.
    staleTime: Infinity,
  });

  const ids = useMemo(() => data ?? [], [data]);
  const savedIds = useMemo(() => new Set(ids), [ids]);

  const isSaved = useCallback(
    (contentId: string) => savedIds.has(contentId),
    [savedIds],
  );

  const { mutate: persist } = useMutation({
    mutationFn: ({ contentId, saved }: { contentId: string; saved: boolean }) =>
      setSavedId(contentId, saved),
    onSuccess: (committed) => {
      pendingSavedWrites = Math.max(0, pendingSavedWrites - 1);
      if (pendingSavedWrites === 0) {
        queryClient.setQueryData(savedIdsQueryKey, committed);
      }
    },
  });

  const toggleSave = useCallback(
    (target: SaveTarget) => {
      if (!isSaveable(target.type)) return;

      const properties = {
        content_id: target.id,
        content_type: target.type,
        content_title: target.title,
      };

      // Derive from the cache at tap time, not from this render's snapshot.
      // A second tap can arrive before React renders the first optimistic move.
      const current =
        queryClient.getQueryData<string[]>(savedIdsQueryKey) ?? ids;
      const wasSaved = current.includes(target.id);
      queryClient.setQueryData(
        savedIdsQueryKey,
        wasSaved
          ? withoutSavedId(current, target.id)
          : withSavedId(current, target.id),
      );

      pendingSavedWrites += 1;
      persist({ contentId: target.id, saved: !wasSaved });
      posthog.capture(
        wasSaved ? "content_unsaved" : "content_saved",
        properties,
      );
    },
    [ids, persist],
  );

  return { savedIds: ids, isSaved, toggleSave };
}
