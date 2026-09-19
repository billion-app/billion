/**
 * Notification history for Your alerts, and the test send from Settings.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";

import type { AlertItem } from "~/utils/alert-history";
import {
  prependAlert,
  readAlertHistory,
  seedAlertHistory,
  TEST_ALERT,
} from "~/utils/alert-history";

interface HistoryView {
  items: AlertItem[];
  isLoading: boolean;
}

let snapshot: HistoryView = { items: [], isLoading: true };
let hydrated = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: AlertItem[]) {
  snapshot = { items: next, isLoading: !hydrated };
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

async function hydrate(): Promise<void> {
  inFlight ??= (async () => {
    await readAlertHistory();
    const seeded = await seedAlertHistory();
    hydrated = true;
    publish(seeded);
  })();
  return inFlight;
}

export function useAlertHistory() {
  const view = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );

  useEffect(() => {
    void hydrate();
  }, []);

  const sendTest = useCallback(async (patch?: Partial<AlertItem>) => {
    await hydrate();
    const next = await prependAlert({
      id: `test-${Date.now()}`,
      at: new Date().toISOString(),
      ...TEST_ALERT,
      ...patch,
    });
    publish(next);
    return next[0];
  }, []);

  return { ...view, sendTest };
}
