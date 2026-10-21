/** Server-accepted pushes on phones; scheduled local tests on simulators. */
import { useCallback, useEffect, useState } from "react";
import * as Device from "expo-device";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { AlertTranslationWait } from "~/utils/alert-translation-wait";
import { parseAlertHistory, readAlertHistory } from "~/utils/alert-history";
import { alertTranslationWait } from "~/utils/alert-translation-wait";
import { trpcClient } from "~/utils/api";
import { cardTranslationDelay } from "~/utils/card-translation";
import { ensurePushToken } from "~/utils/push-sync";
import { useAppTranslation } from "./useAppTranslation";

export function useAlertHistory() {
  const { language, t } = useAppTranslation();
  const [wait, setWait] = useState<AlertTranslationWait | null>(null);
  const [expiredWait, setExpiredWait] = useState<AlertTranslationWait | null>(
    null,
  );
  const { data, dataUpdatedAt, isPending, error, refetch } = useQuery({
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
      wait !== null &&
      Date.now() < wait.deadline &&
      query.state.data?.some((item) => item.translationState === "pending")
        ? cardTranslationDelay(query.state.dataUpdateCount - 1)
        : false,
  });
  const nextWait = alertTranslationWait(wait, language, data, dataUpdatedAt);
  if (nextWait !== wait)
    setWait(() => alertTranslationWait(wait, language, data, Date.now()));
  useEffect(() => {
    if (!wait) return;
    const timeout = setTimeout(
      () => setExpiredWait(wait),
      Math.max(0, wait.deadline - Date.now()),
    );
    return () => clearTimeout(timeout);
  }, [wait]);
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  return {
    items: data ?? [],
    isLoading: isPending,
    error,
    translationUnavailable: wait !== null && expiredWait === wait,
    retry: () => {
      setWait(alertTranslationWait(null, language, data, Date.now()));
      void refetch();
    },
  };
}
