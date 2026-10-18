/**
 * The reader's app language, shared by every screen.
 *
 * Same module-store pattern as notification preferences: no provider, one
 * in-memory snapshot, AsyncStorage behind it. Until the reader picks a
 * language, the device's preferred languages decide.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AppLanguage } from "~/i18n/language";
import type { StringKey } from "~/i18n/strings";
import { posthog } from "~/config/posthog";
import { isAppLanguage, languageFromLocales } from "~/i18n/language";
import { translate } from "~/i18n/strings";

const STORAGE_KEY = "billion.language.v1";

function deviceLanguage(): AppLanguage {
  try {
    return languageFromLocales(
      Localization.getLocales().map((locale) => locale.languageTag),
    );
  } catch {
    return "en";
  }
}

let language: AppLanguage = deviceLanguage();
let hydrated = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: AppLanguage) {
  language = next;
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

function hydrate(): Promise<void> {
  inFlight ??= (async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (isAppLanguage(stored)) publish(stored);
    } catch {
      // Unreadable storage keeps the device default.
    }
    hydrated = true;
  })();
  return inFlight;
}

export function useLanguage() {
  const current = useSyncExternalStore(
    subscribe,
    () => language,
    () => language,
  );

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, []);

  const setLanguage = useCallback((next: AppLanguage) => {
    void hydrate().then(() => {
      if (next === language) return;
      posthog.capture("app_language_changed", { from: language, to: next });
      publish(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
    });
  }, []);

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) =>
      translate(current, key, vars),
    [current],
  );

  return { language: current, setLanguage, t };
}
