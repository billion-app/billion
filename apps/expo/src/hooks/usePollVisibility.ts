import { useSyncExternalStore } from "react";

let showPolls = false;
const listeners = new Set<() => void>();

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

function setShowPolls(next: boolean) {
  if (showPolls === next) return;
  showPolls = next;
  for (const notify of listeners) notify();
}

export function usePollVisibility() {
  const visible = useSyncExternalStore(
    subscribe,
    () => showPolls,
    () => false,
  );
  return { showPolls: visible, setShowPolls };
}
