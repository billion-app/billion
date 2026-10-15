import { useEffect, useRef, useState } from "react";
import { BackHandler, Linking, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { PublicTrillionGraph } from "@acme/validators";

import type { TrillionReaderHandle } from "./dom/TrillionReader";
import { queryClient, trpc } from "~/utils/api";
import TrillionReader from "./dom/TrillionReader";
import { TrillionLoading } from "./TrillionLoading";

/** Full-screen host for the reader; the web view draws its own header. */
export function TrillionScreen({
  graph,
  view,
  ballot,
}: {
  graph: PublicTrillionGraph;
  view?: "list" | "map";
  ballot?: string[];
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const storageKey = `billion.trillion.${graph.electionDate}.${graph.measure.number}`;
  const [stored, setStored] = useState<{ key: string; value: string } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then(
      (value) => {
        if (active) setStored({ key: storageKey, value: value ?? "" });
      },
      () => {
        if (active) setStored({ key: storageKey, value: "" });
      },
    );
    return () => {
      active = false;
    };
  }, [storageKey]);
  const reader = useRef<TrillionReaderHandle>(null);
  // Back stays inside the reader below the main case or with a sheet or the full map open.
  // Then the edge swipe and Android's back action step back like the reader's back button,
  // instead of the stack leaving the whole debate.
  const [backInside, setBackInside] = useState(false);
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !backInside });
  }, [navigation, backInside]);
  useEffect(() => {
    if (!backInside || Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        reader.current?.goBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [backInside]);
  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {stored?.key === storageKey ? (
        <TrillionReader
          key={storageKey}
          localState={stored.value}
          onLocalState={async (value) => {
            await AsyncStorage.setItem(storageKey, value);
          }}
          ref={reader}
          graph={graph}
          view={view}
          ballot={ballot}
          onExit={() => Promise.resolve(router.back())}
          onOpenUrl={async (url) => {
            await Linking.openURL(url);
          }}
          onOpenMeasure={(number) => {
            void queryClient.prefetchQuery(
              trpc.civic.getTrillion.queryOptions({ number }),
            );
            router.push({
              pathname: "/proposition-detail",
              params: { number },
            });
            return Promise.resolve();
          }}
          onBackState={(inside) => Promise.resolve(setBackInside(inside))}
          dom={{
            style: s.web,
            bounces: false,
            contentInsetAdjustmentBehavior: "never",
          }}
        />
      ) : (
        <TrillionLoading />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  // The reader's navy, so the safe area and the web view read as one surface.
  screen: { flex: 1, backgroundColor: "#0E1530" },
  web: { flex: 1, backgroundColor: "#0E1530" },
});
