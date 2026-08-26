import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { posthog } from "~/config/posthog";
import { queryClient } from "~/utils/api";
import { addSavedId, readSavedIds, removeSavedId } from "~/utils/saved-store";

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

  const saveMutation = useMutation({
    mutationFn: addSavedId,
    // The write returns the list it committed, so the cache ends up agreeing
    // with the device rather than with what the tap assumed.
    onSuccess: (committed) =>
      queryClient.setQueryData(savedIdsQueryKey, committed),
  });

  const unsaveMutation = useMutation({
    mutationFn: removeSavedId,
    onSuccess: (committed) =>
      queryClient.setQueryData(savedIdsQueryKey, committed),
  });

  const toggleSave = useCallback(
    (target: SaveTarget) => {
      if (!isSaveable(target.type)) return;

      const properties = {
        content_id: target.id,
        content_type: target.type,
        content_title: target.title,
      };

      // A bookmark has to fill the moment it is tapped, so the cache moves
      // first and the device write follows.
      const withoutTarget = ids.filter((id) => id !== target.id);

      if (savedIds.has(target.id)) {
        queryClient.setQueryData(savedIdsQueryKey, withoutTarget);
        unsaveMutation.mutate(target.id);
        posthog.capture("content_unsaved", properties);
      } else {
        queryClient.setQueryData(savedIdsQueryKey, [
          target.id,
          ...withoutTarget,
        ]);
        saveMutation.mutate(target.id);
        posthog.capture("content_saved", properties);
      }
    },
    [ids, savedIds, saveMutation, unsaveMutation],
  );

  return { savedIds: ids, isSaved, toggleSave };
}
