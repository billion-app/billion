export const MEASURE_GRAPH_STALE_TIME = 60_000;

type PauseReason = "inactive" | "touch" | "scroll";
export interface IdleScheduler {
  request: (
    callback: (deadline: { timeRemaining: () => number }) => void,
  ) => number;
  cancel: (handle: number) => void;
}

declare const requestIdleCallback: IdleScheduler["request"];
declare const cancelIdleCallback: IdleScheduler["cancel"];

export function createIdleMeasurePreloader(
  preload: (number: string) => Promise<void>,
  idle: IdleScheduler | undefined = typeof requestIdleCallback === "function" &&
  typeof cancelIdleCallback === "function"
    ? {
        request: (callback) => requestIdleCallback(callback),
        cancel: (handle) => cancelIdleCallback(handle),
      }
    : undefined,
) {
  let measures: readonly string[] = [];
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
      index >= measures.length
    )
      return;
    pendingIdle = idle.request((deadline) => {
      pendingIdle = undefined;
      if (disposed || paused.size) return;
      if (deadline.timeRemaining() <= 0) {
        schedule();
        return;
      }
      const number = measures[index++];
      if (number === undefined) return;
      fetching = true;
      void preload(number).then(() => {
        fetching = false;
        schedule();
      });
    });
  }

  return {
    setMeasures(next: readonly string[]) {
      measures = next;
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
