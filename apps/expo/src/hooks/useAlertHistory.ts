/** Server-accepted pushes on phones; scheduled local tests on simulators. */
import { useCallback } from "react";
import * as Device from "expo-device";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { parseAlertHistory, readAlertHistory } from "~/utils/alert-history";
import { trpcClient } from "~/utils/api";
import { ensurePushToken } from "~/utils/push-sync";

export function useAlertHistory() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["notification-history"],
    queryFn: async () => {
      if (!Device.isDevice) return readAlertHistory();
      const token = await ensurePushToken();
      if (!token)
        throw new Error("Enable notifications to load this phone's alerts.");
      const rows = await trpcClient.notifications.history.query({ token });
      return parseAlertHistory(JSON.stringify(rows));
    },
  });
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  return { items: data ?? [], isLoading: isPending, error };
}
