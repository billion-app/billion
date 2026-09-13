import { Linking, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import type { IconName } from "~/components/ui";
import { Text } from "~/components/Themed";
import { ScreenShell, SettingsRow } from "~/components/ui";
import { fontBody, fontDisplay, DigestPalette as P } from "~/styles";
import { getAppVersionLabel } from "~/utils/app-version";

export default function AboutScreen() {
  const router = useRouter();

  const rows: { icon: IconName; label: string; onPress: () => void }[] = [
    {
      icon: "globe",
      label: "billion-news.app",
      onPress: () => void Linking.openURL("https://billion-news.app"),
    },
    {
      icon: "doc",
      label: "Open-source licenses",
      onPress: () => router.push("/settings/terms"),
    },
    {
      icon: "shield",
      label: "Privacy",
      onPress: () => router.push("/settings/privacy"),
    },
    {
      icon: "doc",
      label: "Terms",
      onPress: () => router.push("/settings/terms"),
    },
  ];

  return (
    <ScreenShell title="About">
      <View style={s.hero}>
        <Text style={s.name}>Billion</Text>
        <Text style={s.version}>{getAppVersionLabel()}</Text>
        <Text style={s.upToDate}>Up to date</Text>
      </View>

      <Text style={s.blurb}>
        The public record, <Text style={s.blurbEm}>worth reading</Text>.
      </Text>

      {rows.map((r, i) => (
        <SettingsRow
          key={r.label}
          icon={r.icon}
          label={r.label}
          last={i === rows.length - 1}
          onPress={r.onPress}
        />
      ))}

      <Text style={s.footer}>© 2026 Bryan Hu</Text>
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 28, paddingBottom: 20 },
  name: {
    fontFamily: fontDisplay.bold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
    color: P.inkOnNight,
  },
  version: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: P.quiet,
    marginTop: 8,
  },
  upToDate: {
    fontFamily: fontBody.semibold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: P.spark,
    marginTop: 14,
  },
  blurb: {
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 24,
    color: P.quiet,
    textAlign: "center",
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  blurbEm: {
    fontFamily: fontDisplay.italic,
    fontStyle: "italic",
    color: P.inkOnNight,
  },
  footer: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: P.quiet,
    textAlign: "center",
    marginTop: 36,
  },
});
