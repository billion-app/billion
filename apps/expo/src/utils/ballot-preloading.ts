import type { StackNavigationState } from "expo-router";

export const BALLOT_STALE_TIME = 60_000;
const MAX_PRELOADED_READERS = 2;

type PauseReason = "inactive" | "touch" | "scroll";
export interface IdleScheduler {
  request: (
    callback: (deadline: { timeRemaining: () => number }) => void,
  ) => number;
  cancel: (handle: number) => void;
}

declare const requestIdleCallback: IdleScheduler["request"];
declare const cancelIdleCallback: IdleScheduler["cancel"];

export function createIdlePreloader<T>(
  preload: (item: T) => Promise<void>,
  idle: IdleScheduler | undefined = typeof requestIdleCallback === "function" &&
  typeof cancelIdleCallback === "function"
    ? {
        request: (callback) => requestIdleCallback(callback),
        cancel: (handle) => cancelIdleCallback(handle),
      }
    : undefined,
) {
  let items: readonly T[] = [];
  let index = 0;
  let pendingIdle: number | undefined;
  let fetching = false;
  let disposed = false;
  const paused = new Set<PauseReason>();

  function cancelPending() {
    if (pendingIdle !== undefined) idle?.cancel(pendingIdle);
    pendingIdle = undefined;
  }

  function schedule() {
    if (
      !idle ||
      disposed ||
      paused.size ||
      fetching ||
      pendingIdle !== undefined ||
      index >= items.length
    )
      return;
    pendingIdle = idle.request((deadline) => {
      pendingIdle = undefined;
      if (disposed || paused.size) return;
      if (deadline.timeRemaining() <= 0) {
        schedule();
        return;
      }
      const item = items[index++];
      if (item === undefined) return;
      fetching = true;
      void preload(item).then(() => {
        fetching = false;
        schedule();
      });
    });
  }

  return {
    setItems(next: readonly T[]) {
      items = next;
      index = 0;
      schedule();
    },
    setPaused(reason: PauseReason, value: boolean) {
      if (value) {
        paused.add(reason);
        cancelPending();
      } else {
        paused.delete(reason);
        schedule();
      }
    },
    dispose() {
      disposed = true;
      cancelPending();
    },
  };
}

export type BallotPreload =
  | { kind: "guide" }
  | { kind: "elections" }
  | { kind: "graph"; number: string }
  | { kind: "reader"; number: string };

export function ballotPreloads(numbers?: readonly string[]): BallotPreload[] {
  if (!numbers) return [{ kind: "guide" }, { kind: "elections" }];
  return [
    { kind: "guide" },
    ...numbers.flatMap((number, index): BallotPreload[] => [
      { kind: "graph", number },
      ...(index < MAX_PRELOADED_READERS
        ? [{ kind: "reader" as const, number }]
        : []),
    ]),
  ];
}

export function canPreloadReader(
  state: Pick<
    StackNavigationState<Record<string, object | undefined>>,
    "routes" | "preloadedRoutes"
  >,
  number: string,
) {
  const alreadyMounted = [...state.routes, ...state.preloadedRoutes].some(
    (route) =>
      route.name === "proposition-detail" &&
      route.params &&
      "number" in route.params &&
      route.params.number === number,
  );
  const prepared = state.preloadedRoutes.filter(
    (route) => route.name === "proposition-detail",
  ).length;
  return !alreadyMounted && prepared < MAX_PRELOADED_READERS;
}
