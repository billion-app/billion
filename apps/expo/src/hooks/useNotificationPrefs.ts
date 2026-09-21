/**
 * Notification preferences, shared by Settings and the test send.
 *
 * Same module-store pattern as onboarding: no provider, one in-memory
 * snapshot, disk behind it. The first hydrate copies cadence from
 * onboarding if Settings has never been opened.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";

import type { NotificationPrefs } from "~/utils/notification-prefs";
import {
  DEFAULT_NOTIFICATION_PREFS,
  loadNotificationPrefs,
  notificationPrefsFromOnboarding,
  saveNotificationPrefs,
} from "~/utils/notification-prefs";
import { loadOnboarding } from "~/utils/onboarding-store";

interface PrefsView extends NotificationPrefs {
  isLoading: boolean;
}

let state: NotificationPrefs = { ...DEFAULT_NOTIFICATION_PREFS };
let snapshot: PrefsView = { ...DEFAULT_NOTIFICATION_PREFS, isLoading: true };
let hydrated = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: NotificationPrefs) {
  state = next;
  snapshot = { ...next, isLoading: !hydrated };
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

async function hydrate(): Promise<void> {
  inFlight ??= (async () => {
    const loaded = await loadNotificationPrefs();
    if (loaded.settled) {
      hydrated = true;
      publish(loaded);
      return;
    }
    const onboarding = await loadOnboarding();
    const next = notificationPrefsFromOnboarding(loaded, onboarding);
    hydrated = true;
    publish(next);
    if (next.settled) await saveNotificationPrefs(next);
  })();
  return inFlight;
}

export function useNotificationPrefs() {
  const view = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );

  useEffect(() => {
    void hydrate();
  }, []);

  const update = useCallback((patch: Partial<NotificationPrefs>) => {
    void hydrate().then(() => {
      const next = { ...state, ...patch, settled: true };
      publish(next);
      void saveNotificationPrefs(next);
    });
  }, []);

  return { ...view, update };
}
