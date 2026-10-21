import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";

import type {
  CardTranslationData,
  CardTranslationWait,
} from "~/utils/card-translation";
import { trpcClient } from "~/utils/api";
import {
  cardTranslationWait,
  pendingCardTranslations,
  pollCardTranslations,
} from "~/utils/card-translation";

export function useCardTranslationPolling({
  data,
  language,
  refetch,
  enabled = true,
}: {
  data: CardTranslationData | undefined;
  language: "en" | "es" | "zh";
  refetch: Parameters<typeof pollCardTranslations>[0]["refresh"];
  enabled?: boolean;
}) {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => subscription.remove();
  }, []);
  const [attempt, setAttempt] = useState(0);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const session = useRef<CardTranslationWait | null>(null);
  const lookups = useMemo(() => pendingCardTranslations(data), [data]);
  const sourceKey = JSON.stringify(lookups);
  const key = `${language}:${sourceKey}:${attempt}`;

  useEffect(() => {
    if (language === "en" || !lookups.length) {
      session.current = null;
      return;
    }
    if (!enabled || !focused || !active) return;
    const controller = new AbortController();
    const pending = lookups;
    session.current = cardTranslationWait(
      session.current,
      language,
      pending,
      Date.now(),
    );
    const timeout = setTimeout(
      () => {
        setFailedKey(key);
        controller.abort();
      },
      Math.max(0, session.current.deadline - Date.now()),
    );
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          controller.signal.removeEventListener("abort", finish);
          resolve();
        };
        const timer = setTimeout(finish, ms);
        controller.signal.addEventListener("abort", finish, { once: true });
      });
    void pollCardTranslations({
      lookups: pending,
      deadline: session.current.deadline,
      signal: controller.signal,
      ready: (batch) =>
        trpcClient.content.translationStatus.query(
          { language, lookups: batch },
          { signal: controller.signal },
        ),
      refresh: refetch,
      wait,
    })
      .then((result) => {
        if (result === "expired" && !controller.signal.aborted)
          setFailedKey(key);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedKey(key);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [active, enabled, focused, key, language, lookups, refetch]);

  const retry = useCallback(() => {
    session.current = null;
    setAttempt((value) => value + 1);
    void refetch({});
  }, [refetch]);
  return { isError: failedKey === key, retry };
}
