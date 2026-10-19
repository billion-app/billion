import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { AppStoreUpdateCard } from "~/components/AppStoreUpdateBanner";
import { NavHeader } from "~/components/ui/NavHeader";
import { UpdatePromptCard } from "~/components/UpdatePrompt";
import { DigestPalette as P } from "~/styles";

/** Development-only exercise of notification presentation; never installs updates. */
export default function DesignAuditPreview() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [taps, setTaps] = useState(0);
  if (!__DEV__) return null;
  return (
    <View style={{ flex: 1, backgroundColor: P.night }}>
      <NavHeader title="Design verification" />
      <Pressable
        testID="underlying-action"
        onPress={() => setTaps((value) => value + 1)}
        style={{ minHeight: 44, margin: 24 }}
      >
        <Text style={{ color: P.inkOnNight }}>Underlying action: {taps}</Text>
      </Pressable>
      {dismissed ? (
        <Text testID="preview-dismissed" style={{ color: P.inkOnNight }}>
          Dismissed
        </Text>
      ) : kind === "store" ? (
        <AppStoreUpdateCard
          version="1.10.0"
          onOpen={() => setTaps((value) => value + 1)}
          onDismiss={() => setDismissed(true)}
        />
      ) : (
        <UpdatePromptCard
          busy={busy}
          onRestart={() => setBusy(true)}
          onDismiss={() => setDismissed(true)}
        />
      )}
    </View>
  );
}
