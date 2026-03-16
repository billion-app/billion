/**
 * Terms & Privacy screen — settings sub-page
 *
 * MOCK DATA / TODO:
 * - TODO: Terms text is placeholder — replace with legally reviewed copy before launch
 * - TODO: Fetch terms content from CMS or remote config so it can be updated without an app release
 * - TODO: Track terms acceptance with a version timestamp in user preferences (trpc.user.acceptTerms)
 * - TODO: "Last updated" date should be fetched from the terms document, not hardcoded
 * - TODO: Privacy Policy card URL is a placeholder — update before launch
 */

import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { colors, fonts, sp, rd, useTheme } from "~/styles";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "By accessing or using Billion, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use the app.",
  },
  {
    title: "2. Use of the Service",
    body: "Billion provides AI-assisted summaries of publicly available government documents for informational purposes only. Nothing in the app constitutes legal or political advice. You are responsible for verifying any information through primary sources.",
  },
  {
    title: "3. Intellectual Property",
    body: "Original content, UI, and brand elements are owned by Billion, Inc. Government documents reproduced in the app are in the public domain. AI-generated summaries are the intellectual property of Billion, Inc.",
  },
  {
    title: "4. Privacy",
    body: "We collect usage data to improve the app. We do not sell personal information. See our Privacy Policy for full details on data collection, storage, and user rights.",
  },
  {
    title: "5. Limitation of Liability",
    body: "Billion is provided 'as is' without warranties of any kind. We are not liable for any inaccuracies in AI-generated content or for decisions made based on information in the app.",
  },
  {
    title: "6. Changes to Terms",
    body: "We may update these terms from time to time. Continued use of the app after changes constitutes acceptance of the new terms. We will notify you of significant changes.",
  },
];

export default function TermsScreen() {
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
        <Text style={[styles.title, { color: theme.foreground }]}>Terms & Privacy</Text>
        <View style={{ width: 44 }} lightColor="transparent" darkColor="transparent" />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lastUpdated, { color: theme.mutedForeground }]}>
          Last updated February 1, 2026
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section} lightColor="transparent" darkColor="transparent">
            <Text style={[styles.sectionTitle, { color: theme.foreground }]}>{section.title}</Text>
            <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>{section.body}</Text>
          </View>
        ))}

        <View
          style={[styles.privacyCard, { backgroundColor: colors.civicBlue + "18", borderColor: colors.civicBlue + "44" }]}
          lightColor="transparent"
          darkColor="transparent"
        >
          <Text style={[styles.privacyCardTitle, { color: theme.foreground }]}>Privacy Policy</Text>
          <Text style={[styles.privacyCardBody, { color: theme.textSecondary }]}>
            Our full Privacy Policy is available at billion.app/privacy and governs all data collection and processing activities.
          </Text>
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
  lastUpdated: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: sp[5],
    marginBottom: sp[6],
  },
  section: {
    marginBottom: sp[6],
  },
  sectionTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
    marginBottom: sp[2],
  },
  sectionBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
  privacyCard: {
    borderRadius: rd.lg,
    borderWidth: 1,
    padding: sp[5],
    marginBottom: sp[10],
    gap: sp[2],
  },
  privacyCardTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
  },
  privacyCardBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
});
