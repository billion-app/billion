import type { GestureResponderEvent } from "react-native";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useNavigation } from "expo-router";
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
  const navigation = useNavigation();
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
    queue.setPaused("tab", true);
    queue.setPaused("blur", !navigation.isFocused());
    queue.setPaused("background", AppState.currentState !== "active");
    const focus = navigation.addListener("focus", () =>
      queue.setPaused("blur", false),
    );
    const blur = navigation.addListener("blur", () => {
      queue.setPaused("blur", true);
      queue.setPaused("touch", false);
      queue.setPaused("scroll", false);
    });
    const appState = AppState.addEventListener("change", (state) => {
      queue.setPaused("background", state !== "active");
      if (state !== "active") {
        queue.setPaused("touch", false);
        queue.setPaused("scroll", false);
      }
    });
    return () => {
      queue.dispose();
      preloader.current = null;
      focus();
      blur();
      appState.remove();
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [navigation, queryClient]);

  useEffect(() => {
    preloader.current?.setMeasures(numbers);
  }, [numbers, navigation, queryClient]);

  useEffect(() => {
    preloader.current?.setPaused("tab", !enabled);
  }, [enabled, navigation, queryClient]);

  const onTouchStart = useCallback(() => {
    preloader.current?.setPaused("touch", true);
  }, []);
  const onTouchEnd = useCallback((event: GestureResponderEvent) => {
    preloader.current?.setPaused("touch", event.nativeEvent.touches.length > 0);
  }, []);
  const onTouchCancel = useCallback(() => {
    preloader.current?.setPaused("touch", false);
  }, []);
  const onScrollBegin = useCallback(() => {
    preloader.current?.setPaused("scroll", true);
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
  }, []);
  const onScrollEndDrag = useCallback(() => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      preloader.current?.setPaused("scroll", false);
    }, 150);
  }, []);
  const onMomentumScrollEnd = useCallback(() => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    preloader.current?.setPaused("scroll", false);
  }, []);

  return {
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
    onScrollBegin,
    onScrollEndDrag,
    onMomentumScrollEnd,
  };
}
