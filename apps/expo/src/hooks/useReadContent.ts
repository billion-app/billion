import { useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createReadContentStore } from "~/utils/read-content";

const store = createReadContentStore(AsyncStorage);
const queryKey = ["read-content-ids"] as const;
const EMPTY_IDS: string[] = [];

export function useReadContent() {
  const client = useQueryClient();
  const history = useQuery({
    queryKey,
    queryFn: store.read,
    staleTime: Infinity,
  });
  const { mutate } = useMutation({
    mutationFn: store.markRead,
    onSuccess: (ids) => client.setQueryData(queryKey, ids),
  });
  const markRead = useCallback((id: string) => mutate(id), [mutate]);
  return {
    readIds: history.data ?? EMPTY_IDS,
    isLoading: history.isLoading,
    markRead,
  };
}
