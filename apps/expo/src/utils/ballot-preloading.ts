import type { StackNavigationState } from "expo-router";

export const BALLOT_STALE_TIME = 60_000;

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
  | { kind: "retain-readers"; numbers: readonly string[] }
  | { kind: "guide" }
  | { kind: "elections" }
  | { kind: "graph"; number: string }
  | { kind: "reader"; number: string };

export function ballotPreloads(numbers?: readonly string[]): BallotPreload[] {
  if (!numbers) return [{ kind: "guide" }, { kind: "elections" }];
  return [
    { kind: "retain-readers", numbers },
    { kind: "guide" },
    ...numbers.flatMap((number): BallotPreload[] => [
      { kind: "graph", number },
      { kind: "reader", number },
    ]),
  ];
}

type BallotNavigationState = StackNavigationState<
  Record<string, object | undefined>
>;

export function retainVisiblePreloads(
  state: BallotNavigationState,
  numbers: readonly string[],
): BallotNavigationState {
  const preloadedRoutes = state.preloadedRoutes.filter(
    (route) =>
      route.name !== "proposition-detail" ||
      (route.params &&
        "number" in route.params &&
        typeof route.params.number === "string" &&
        numbers.includes(route.params.number)),
  );
  return preloadedRoutes.length === state.preloadedRoutes.length
    ? state
    : { ...state, preloadedRoutes };
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
  return !alreadyMounted;
}
