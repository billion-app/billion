/** Server-accepted pushes on phones; scheduled local tests on simulators. */
import { useCallback } from "react";
import * as Device from "expo-device";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { parseAlertHistory, readAlertHistory } from "~/utils/alert-history";
import { trpcClient } from "~/utils/api";
import { ensurePushToken } from "~/utils/push-sync";
import { useAppTranslation } from "./useAppTranslation";

export function useAlertHistory() {
  const { language, t } = useAppTranslation();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["notification-history", language],
    queryFn: async () => {
      if (!Device.isDevice)
        return (await readAlertHistory()).map((item) =>
          item.kind === "test"
            ? {
                ...item,
                title: t("alerts.testTitle"),
                body: t("alerts.testBody"),
              }
            : item,
        );
      const token = await ensurePushToken();
      if (!token)
        throw new Error("Enable notifications to load this phone's alerts.");
      const rows = await trpcClient.notifications.history.query({
        token,
        language,
      });
      return parseAlertHistory(JSON.stringify(rows));
    },
    refetchInterval: (query) =>
      query.state.data?.some((item) => item.translationState === "pending")
        ? 3_000
        : false,
  });
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  return {
    items: data ?? [],
    isLoading: isPending,
    error,
    retry: () => void refetch(),
  };
}
