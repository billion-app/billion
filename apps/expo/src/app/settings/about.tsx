/**
 * About screen — settings sub-page
 *
 * MOCK DATA / TODO:
 * - TODO: Replace hardcoded "1.0.0 (42)" with real version from expo-constants (Constants.expoConfig.version)
 * - TODO: Replace hardcoded "iOS" with Platform.OS
 * - TODO: Replace hardcoded "release" with build channel from expo-updates (Updates.channel)
 * - TODO: Legal URLs (billion.app/privacy etc.) are placeholder — update with real URLs before launch
 * - TODO: "Open Source Licenses" should use a real OSS license screen (e.g. react-native-oss-licenses)
 */

import { ScrollView, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { colors, fonts, sp, rd, useTheme } from "~/styles";

// TODO: Update URLs before launch
const LINKS = [
  { id: "privacy", label: "Privacy Policy", url: "https://billion.app/privacy", icon: "shield-outline" as const },
  { id: "terms", label: "Terms of Service", url: "https://billion.app/terms", icon: "document-text-outline" as const },
  { id: "oss", label: "Open Source Licenses", url: "https://billion.app/licenses", icon: "code-slash-outline" as const },
];

// TODO: Replace with expo-constants
const VERSION_ROWS = [
  { label: "Version", value: "1.0.0 (42)", icon: "layers-outline" as const },
  // TODO: Replace with Updates.channel from expo-updates
  { label: "Build", value: "release", icon: "construct-outline" as const },
  // TODO: Replace with Platform.OS
  { label: "Platform", value: "iOS", icon: "phone-portrait-outline" as const },
];

export default function AboutScreen() {
  const router = useRouter();
  const { theme } = useTheme();

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
        <Text style={[styles.title, { color: theme.foreground }]}>About</Text>
        <View style={{ width: 44 }} lightColor="transparent" darkColor="transparent" />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Wordmark / logo block */}
        <View style={styles.logoBlock} lightColor="transparent" darkColor="transparent">
          <Text style={[styles.wordmark, { color: colors.white }]}>Billion</Text>
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>
            Civic intelligence for everyone.
          </Text>
        </View>

        {/* Version info */}
        <View
          style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}
          lightColor={theme.card}
          darkColor={theme.card}
        >
          {VERSION_ROWS.map((row, i, arr) => (
            <View
              key={row.label}
              style={[
                styles.infoRow,
                i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
              ]}
              lightColor="transparent"
              darkColor="transparent"
            >
              <View style={styles.infoLeft} lightColor="transparent" darkColor="transparent">
                <Ionicons name={row.icon} size={16} color={theme.mutedForeground} />
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{row.label}</Text>
              </View>
              <Text style={[styles.infoValue, { color: theme.foreground }]}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Links */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>LEGAL</Text>
        <View
          style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}
          lightColor={theme.card}
          darkColor={theme.card}
        >
          {LINKS.map((link, i) => (
            <TouchableOpacity
              key={link.id}
              style={[
                styles.linkRow,
                i < LINKS.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
              ]}
              onPress={() => Linking.openURL(link.url).catch(() => null)}
              activeOpacity={0.7}
            >
              <View style={styles.linkLeft} lightColor="transparent" darkColor="transparent">
                <Ionicons name={link.icon} size={16} color={theme.mutedForeground} />
                <Text style={[styles.linkLabel, { color: theme.foreground }]}>{link.label}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={theme.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.credit, { color: theme.mutedForeground }]}>
          Made with care in the United States.{"\n"}© 2026 Billion, Inc.
        </Text>
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
  logoBlock: {
    alignItems: "center",
    paddingTop: sp[10],
    paddingBottom: sp[8],
    gap: sp[2],
  },
  wordmark: {
    fontFamily: "IBMPlexSerif_700Bold",
    fontSize: 40,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: fonts.editorialRegular,
    fontSize: 15,
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
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: sp[4],
    paddingVertical: sp[4],
  },
  infoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp[3],
  },
  infoLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  infoValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: sp[4],
    paddingVertical: sp[4],
  },
  linkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp[3],
  },
  linkLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  credit: {
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    paddingBottom: sp[10],
  },
});
