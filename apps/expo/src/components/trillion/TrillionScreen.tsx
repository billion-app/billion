import { Linking, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import type { PublicTrillionGraph } from "@acme/validators";

import TrillionReader from "./dom/TrillionReader";

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
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <TrillionReader
        graph={graph}
        view={view}
        ballot={ballot}
        onExit={() => Promise.resolve(router.back())}
        onOpenUrl={async (url) => {
          await Linking.openURL(url);
        }}
        onOpenMeasure={(number) =>
          // The proposition page offers its own debate when one exists.
          Promise.resolve(
            router.push({
              pathname: "/proposition-detail",
              params: { number },
            }),
          )
        }
        dom={{
          style: s.web,
          bounces: false,
          contentInsetAdjustmentBehavior: "never",
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  // The reader's navy, so the safe area and the web view read as one surface.
  screen: { flex: 1, backgroundColor: "#0E1530" },
  web: { flex: 1, backgroundColor: "#0E1530" },
});
