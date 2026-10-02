import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { PrivatePreparation } from "~/components/preparation/PrivatePreparation";
import { NavHeader } from "~/components/ui/NavHeader";
import { DigestPalette as P, sp } from "~/styles";

/** Device archive remains reachable without fetching a ballot or signing in. */
export default function BallotPreparationRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: P.canvas }}>
      <NavHeader
        title=""
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/elections")
        }
      />
      <ScrollView
        contentContainerStyle={{
          padding: sp[4],
          paddingBottom: insets.bottom + sp[6],
        }}
      >
        <PrivatePreparation provider="archive" initiallyOpen />
      </ScrollView>
    </View>
  );
}
