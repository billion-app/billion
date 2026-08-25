import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import { posthog } from "~/config/posthog";
import { queryClient, trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

/** The content types the saved-articles table accepts. */
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

interface SavedIds {
  savedIds: string[];
}

/**
 * The reader's saved set, and the one way to change it.
 *
 * Held as a whole set rather than a per-card `isSaved` query: a list screen
 * would otherwise open one request per row, and there is no page of results
 * the answer does not already cover. It also gives every screen the same
 * source of truth, so a bill saved on the article page is already filled in
 * when the reader swipes back to Browse.
 */
export function useSavedContent() {
  const { data: session } = authClient.useSession();
  const isSignedIn = !!session?.user;

  // Stable across renders so the callbacks below can depend on it.
  const savedIdsKey = useMemo(() => trpc.content.saved.allIds.queryKey(), []);

  const { data } = useQuery({
    ...trpc.content.saved.allIds.queryOptions(),
    // A protected procedure: querying it signed out throws UNAUTHORIZED.
    enabled: isSignedIn,
    staleTime: 60_000,
  });

  const savedIds = useMemo(
    () => new Set(data?.savedIds ?? []),
    [data?.savedIds],
  );

  /**
   * A bookmark has to fill the moment it is tapped. Waiting for the write and
   * the refetch reads as a dead button, so the local set moves first.
   */
  const writeSavedIds = useCallback(
    (next: (ids: string[]) => string[]) => {
      queryClient.setQueryData<SavedIds>(savedIdsKey, (previous) => ({
        savedIds: next(previous?.savedIds ?? []),
      }));
    },
    [savedIdsKey],
  );

  const revalidate = () => {
    void queryClient.invalidateQueries({ queryKey: savedIdsKey });
    // The saved list is a separate cache and is wrong the moment this set
    // changes. `isSaved` no longer has callers in the app, but it is still a
    // live procedure, so it is dropped here rather than left to go stale if
    // something reaches for it again.
    void queryClient.invalidateQueries({
      queryKey: trpc.content.saved.list.infiniteQueryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: trpc.content.saved.isSaved.pathKey(),
    });
  };

  const saveMutation = useMutation({
    ...trpc.content.saved.add.mutationOptions(),
    onSettled: revalidate,
  });

  const unsaveMutation = useMutation({
    ...trpc.content.saved.remove.mutationOptions(),
    onSettled: revalidate,
  });

  const isSaved = useCallback(
    (contentId: string) => savedIds.has(contentId),
    [savedIds],
  );

  const toggleSave = useCallback(
    (target: SaveTarget) => {
      if (!isSaveable(target.type)) return;

      if (!isSignedIn) {
        Alert.alert(
          "Sign in to save",
          "Sign in to bookmark and revisit content.",
        );
        return;
      }

      const properties = {
        content_id: target.id,
        content_type: target.type,
        content_title: target.title,
      };

      // Snapshotted before the optimistic write so a failed request can put
      // the bookmark back without waiting for a refetch that may not be
      // reachable — a save tapped on a train should not leave a lie on screen.
      const previous = queryClient.getQueryData<SavedIds>(savedIdsKey);
      const rollback = {
        onError: () => {
          if (previous) queryClient.setQueryData(savedIdsKey, previous);
        },
      };

      if (savedIds.has(target.id)) {
        writeSavedIds((ids) => ids.filter((id) => id !== target.id));
        unsaveMutation.mutate({ contentId: target.id }, rollback);
        posthog.capture("content_unsaved", properties);
      } else {
        writeSavedIds((ids) =>
          ids.includes(target.id) ? ids : [...ids, target.id],
        );
        saveMutation.mutate(
          { contentId: target.id, contentType: target.type },
          rollback,
        );
        posthog.capture("content_saved", properties);
      }
    },
    [
      isSignedIn,
      savedIds,
      savedIdsKey,
      writeSavedIds,
      saveMutation,
      unsaveMutation,
    ],
  );

  return { isSaved, toggleSave, isSignedIn };
}
