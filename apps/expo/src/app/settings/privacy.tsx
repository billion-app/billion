/**
 * Privacy Settings screen — settings sub-page
 *
 * MOCK DATA / TODO:
 * - TODO: Load initial toggle states from tRPC (trpc.user.preferences.get)
 * - TODO: Persist each toggle via tRPC mutation (trpc.user.preferences.setPrivacy)
 * - TODO: "Download My Data" should trigger a GDPR/CCPA data export request via tRPC
 * - TODO: Location-Based Content toggle should request device location permission when enabled
 * - TODO: Analytics toggle should integrate with analytics SDK opt-in/out (e.g. Amplitude, PostHog)
 */

import { useState } from "react";
import { ScrollView, StyleSheet, Switch, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { colors, fonts, sp, rd, useTheme } from "~/styles";

interface ToggleRow {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}

const PRIVACY_TOGGLES: ToggleRow[] = [
  {
    id: "analytics",
    label: "Usage Analytics",
    description: "Help improve the app by sharing anonymous usage data.",
    icon: "analytics-outline",
  },
  {
    id: "personalization",
    label: "Personalized Feed",
    description: "Allow us to use your reading history to tailor content.",
    icon: "sparkles-outline",
  },
  {
    id: "location",
    label: "Location-Based Content",
    description: "Show content relevant to your state and district.",
    icon: "location-outline",
  },
  {
    id: "crash",
    label: "Crash Reports",
    description: "Automatically send crash reports to help fix bugs.",
    icon: "bug-outline",
  },
];

export default function PrivacyScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    analytics: false,
    personalization: true,
    location: true,
    crash: true,
  });

  const set = (id: string, value: boolean) =>
    setToggles((prev) => ({ ...prev, [id]: value }));

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.foreground }]}>Privacy Settings</Text>
        <View style={{ width: 44 }} lightColor="transparent" darkColor="transparent" />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: theme.textSecondary }]}>
          Control how Billion uses your data. We never sell personal information.
        </Text>

        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>DATA & PERSONALIZATION</Text>
        <View
          style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}
          lightColor={theme.card}
          darkColor={theme.card}
        >
          {PRIVACY_TOGGLES.map((row, i) => (
            <View
              key={row.id}
              style={[
                styles.row,
                i < PRIVACY_TOGGLES.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
              ]}
              lightColor="transparent"
              darkColor="transparent"
            >
              <Ionicons name={row.icon} size={18} color={theme.mutedForeground} style={{ marginRight: sp[3] }} />
              <View style={styles.rowText} lightColor="transparent" darkColor="transparent">
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>{row.label}</Text>
                <Text style={[styles.rowDesc, { color: theme.textSecondary }]}>{row.description}</Text>
              </View>
              <Switch
                value={toggles[row.id]}
                onValueChange={(v) => set(row.id, v)}
                trackColor={{ false: theme.muted, true: colors.civicBlue }}
                thumbColor={colors.white}
              />
            </View>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>ACCOUNT</Text>
        <View
          style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}
          lightColor={theme.card}
          darkColor={theme.card}
        >
          <TouchableOpacity style={styles.linkRow}>
            <Text style={[styles.linkLabel, { color: theme.foreground }]}>Download My Data</Text>
            <Ionicons name="download-outline" size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp[4],
    paddingVertical: sp[4],
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
  },
  scroll: { flex: 1, paddingHorizontal: sp[5] },
  intro: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: sp[5],
    marginBottom: sp[6],
  },
  sectionLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: sp[2],
    marginTop: sp[2],
  },
  section: {
    borderRadius: rd.lg,
    borderWidth: 1,
    marginBottom: sp[6],
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp[4],
    paddingVertical: sp[4],
  },
  rowText: { flex: 1, marginRight: sp[4] },
  rowLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    marginBottom: sp[1],
  },
  rowDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: sp[4],
    paddingVertical: sp[4],
  },
  linkLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
});
