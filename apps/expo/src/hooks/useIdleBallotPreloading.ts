import type { NativeStackNavigationProp } from "expo-router";
import type { GestureResponderEvent } from "react-native";
import { useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { useIsFocused, useNavigation, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import type { BallotPreload } from "~/utils/ballot-preloading";
import { trpc } from "~/utils/api";
import {
  BALLOT_STALE_TIME,
  ballotPreloads,
  canPreloadReader,
  createIdlePreloader,
} from "~/utils/ballot-preloading";

export function useIdleBallotPreloading({
  numbers,
  enabled,
}: {
  numbers?: readonly string[];
  enabled: boolean;
}) {
  const focused = useIsFocused();
  const router = useRouter();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<Record<string, object | undefined>>
    >("/");
  const items = useMemo(() => ballotPreloads(numbers), [numbers]);
  const queryClient = useQueryClient();
  const preloader =
    useRef<ReturnType<typeof createIdlePreloader<BallotPreload>>>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const queue = createIdlePreloader<BallotPreload>((item) => {
      switch (item.kind) {
        case "guide":
          return queryClient.prefetchQuery(
            trpc.civic.getCaliforniaGuide.queryOptions(undefined, {
              staleTime: BALLOT_STALE_TIME,
              retry: false,
            }),
          );
        case "graph":
          return queryClient.prefetchQuery(
            trpc.civic.getTrillion.queryOptions(
              { number: item.number },
              { staleTime: BALLOT_STALE_TIME, retry: false },
            ),
          );
        case "elections":
          router.prefetch("/elections");
          return Promise.resolve();
        case "reader":
          if (canPreloadReader(navigation.getState(), item.number)) {
            router.prefetch({
              pathname: "/proposition-detail",
              params: { number: item.number },
            });
          }
          return Promise.resolve();
      }
    });
    preloader.current = queue;
    return () => {
      queue.dispose();
      preloader.current = null;
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [queryClient, router, navigation]);

  useEffect(() => {
    preloader.current?.setItems(items);
  }, [items, focused, queryClient, router, navigation]);

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
  }, [enabled, focused, queryClient, router, navigation]);

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
