import { Linking, StyleSheet, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import type { IconName } from "~/components/ui";
import { Text } from "~/components/Themed";
import { Card, Icon, ScreenShell } from "~/components/ui";
import { colors, fontBody, fontDisplay, hair, planes } from "~/styles";

export default function AboutScreen() {
  const router = useRouter();

  const rows: { icon: IconName; label: string; onPress: () => void }[] = [
    {
      icon: "globe",
      label: "Visit billion.app",
      onPress: () => void Linking.openURL("https://billion.app"),
    },
    {
      icon: "doc",
      label: "Open-source licenses",
      onPress: () => router.push("/settings/terms"),
    },
    {
      icon: "shield",
      label: "Privacy policy",
      onPress: () => router.push("/settings/privacy"),
    },
    {
      icon: "doc",
      label: "Terms of service",
      onPress: () => router.push("/settings/terms"),
    },
  ];

  return (
    <ScreenShell title="About">
      <View style={s.hero}>
        <LinearGradient colors={[planes.slate, planes.navy]} style={s.logo}>
          <Text style={s.logoText}>B</Text>
        </LinearGradient>
        <Text style={s.name}>Billion</Text>
        <Text style={s.version}>Version 2.4.0 (build 1182)</Text>
        <View style={s.upToDate}>
          <Icon name="check" size={14} color={colors.green[500]} />
          <Text style={s.upToDateText}>You&apos;re up to date</Text>
        </View>
      </View>

      <Text style={s.blurb}>
        Turning the public record into something{" "}
        <Text style={s.blurbEm}>worth reading</Text> — so being an informed
        citizen doesn&apos;t feel like homework.
      </Text>

      <Card flush style={{ marginBottom: 22 }}>
        {rows.map((r, i) => (
          <TouchableOpacity
            key={r.label}
            style={[s.row, i < rows.length - 1 && s.divider]}
            onPress={r.onPress}
            activeOpacity={0.7}
          >
            <Icon name={r.icon} size={18} color={colors.white} />
            <Text style={s.rowLabel}>{r.label}</Text>
            <Icon name="external" size={16} color="#5B6172" />
          </TouchableOpacity>
        ))}
      </Card>

      <Text style={s.footer}>Built for the public record · © 2026 Billion</Text>
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 12, paddingBottom: 26 },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: hair[2],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoText: { fontFamily: fontDisplay.bold, fontSize: 40, color: colors.white },
  name: { fontFamily: "IBMPlexSerif-Bold", fontSize: 26, color: colors.white },
  version: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  upToDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 13,
  },
  upToDateText: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    color: colors.green[500],
  },
  blurb: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 15,
    lineHeight: 23,
    color: "rgba(255,255,255,0.78)",
    textAlign: "center",
    marginBottom: 26,
    paddingHorizontal: 6,
  },
  blurbEm: {
    fontFamily: fontDisplay.italic,
    fontStyle: "italic",
    color: colors.white,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: hair[1] },
  rowLabel: {
    flex: 1,
    fontFamily: fontBody.semibold,
    fontSize: 14.5,
    color: colors.white,
  },
  footer: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
