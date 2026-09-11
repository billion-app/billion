/**
 * ScreenShell — NavHeader + scrolling padded body for settings sub-screens.
 * Night canvas, Digest pad rhythm, no empty wells.
 */
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { DigestPalette as P, DigestSpace } from "~/styles";
import { NavHeader } from "./NavHeader";

export function ScreenShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <View style={s.screen}>
      <NavHeader title={title} onBack={() => router.back()} action={action} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: DigestSpace.screenPadX,
    paddingTop: 16,
    paddingBottom: 48,
  },
});
