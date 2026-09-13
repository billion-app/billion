/**
 * Onboarding answers, shared across the flow and the screens that react to it.
 *
 * A module-level store read through `useSyncExternalStore` rather than context:
 * the root layout reads it to decide whether to gate, the flow screens write to
 * it, and the dashboard reads it to decide whether to show the claim bar — all
 * without a provider wrapping the router, and all seeing the same value in the
 * same render.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";

import type { OnboardingState } from "~/utils/onboarding-store";
import {
  EMPTY_ONBOARDING,
  loadOnboarding,
  resetOnboarding,
  saveOnboarding,
} from "~/utils/onboarding-store";

/** `isLoading` is true until the disk read lands: before that, "not onboarded"
 *  and "not yet known" are indistinguishable, and gating on the wrong one
 *  would flash the flow at a returning reader. */
interface OnboardingView extends OnboardingState {
  isLoading: boolean;
}

let state: OnboardingState = EMPTY_ONBOARDING;
/** Snapshot identity only changes when the store does, as the hook requires. */
let snapshot: OnboardingView = { ...EMPTY_ONBOARDING, isLoading: true };
let hydrated = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: OnboardingState) {
  state = next;
  snapshot = { ...next, isLoading: !hydrated };
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

async function hydrate(): Promise<void> {
  inFlight ??= loadOnboarding().then((loaded) => {
    hydrated = true;
    publish(loaded);
  });
  return inFlight;
}

export function useOnboarding() {
  const view = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );

  useEffect(() => {
    void hydrate();
  }, []);

  const update = useCallback((patch: Partial<OnboardingState>) => {
    const next = { ...state, ...patch };
    publish(next);
    void saveOnboarding(next);
  }, []);

  const reset = useCallback(() => {
    hydrated = true;
    publish(EMPTY_ONBOARDING);
    void resetOnboarding();
  }, []);

  return { ...view, update, reset };
}
