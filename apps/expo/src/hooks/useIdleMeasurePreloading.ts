import type { GestureResponderEvent } from "react-native";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { trpc } from "~/utils/api";
import {
  createIdleMeasurePreloader,
  MEASURE_GRAPH_STALE_TIME,
} from "~/utils/measure-preloading";

export function useIdleMeasurePreloading(
  numbers: readonly string[],
  enabled: boolean,
) {
  const focused = useIsFocused();
  const queryClient = useQueryClient();
  const preloader = useRef<ReturnType<typeof createIdleMeasurePreloader>>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const queue = createIdleMeasurePreloader((number) =>
      queryClient.prefetchQuery(
        trpc.civic.getTrillion.queryOptions(
          { number },
          { staleTime: MEASURE_GRAPH_STALE_TIME, retry: false },
        ),
      ),
    );
    preloader.current = queue;
    return () => {
      queue.dispose();
      preloader.current = null;
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [queryClient]);

  useEffect(() => {
    preloader.current?.setMeasures(numbers);
  }, [numbers, queryClient]);

  useEffect(() => {
    const queue = preloader.current;
    const update = () => {
      const active = enabled && focused && AppState.currentState === "active";
      queue?.setPaused("inactive", !active);
      if (!active) {
        if (scrollTimer.current) clearTimeout(scrollTimer.current);
        queue?.setPaused("touch", false);
        queue?.setPaused("scroll", false);
      }
    };
    update();
    const subscription = AppState.addEventListener("change", update);
    return () => {
      subscription.remove();
      queue?.setPaused("inactive", true);
    };
  }, [enabled, focused, queryClient]);

  function onMomentumScrollEnd() {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    preloader.current?.setPaused("scroll", false);
  }

  return {
    onTouchStart: () => preloader.current?.setPaused("touch", true),
    onTouchEnd: (event: GestureResponderEvent) =>
      preloader.current?.setPaused(
        "touch",
        event.nativeEvent.touches.length > 0,
      ),
    onTouchCancel: () => preloader.current?.setPaused("touch", false),
    onScrollBegin: () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      preloader.current?.setPaused("scroll", true);
    },
    onScrollEndDrag: () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(onMomentumScrollEnd, 150);
    },
    onMomentumScrollEnd,
  };
}
