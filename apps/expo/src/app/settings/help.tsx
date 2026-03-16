/**
 * Help & Support screen — settings sub-page
 *
 * MOCK DATA / TODO:
 * - TODO: FAQs are hardcoded — replace with CMS-driven content (e.g. fetched from Contentful or tRPC)
 * - TODO: "Chat" button is non-functional — integrate with a support SDK (e.g. Intercom, Zendesk)
 * - TODO: Add a "Report a bug" shortcut that pre-fills the feedback form with category="bug"
 * - TODO: Add search functionality to filter FAQs
 * - TODO: FAQ items should be collapsible accordions rather than always-expanded
 */

import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { colors, fonts, sp, rd, useTheme } from "~/styles";

const FAQS = [
  {
    q: "Where does Billion get its content?",
    a: "We pull from official government sources — Congress.gov, Federal Register, and PACER — and curate news from verified outlets. All AI summaries are clearly labeled.",
  },
  {
    q: "How does the AI summarization work?",
    a: "We use large language models to distill lengthy legislative text into plain English. Summaries always link to the original source document.",
  },
  {
    q: "Can I trust the information on Billion?",
    a: "Every piece of content is sourced from primary government records. Our AI adds context but never alters facts. Use the 'Original' tab to verify anything.",
  },
  {
    q: "How do I report an error?",
    a: "Tap the flag icon on any card to report inaccurate content. Our editorial team reviews all reports within 24 hours.",
  },
  {
    q: "Is Billion free?",
    a: "Core features are free. Billion Pro unlocks unlimited saves, personalized alerts, and advanced search.",
  },
];

export default function HelpScreen() {
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
        <Text style={[styles.title, { color: theme.foreground }]}>Help & Support</Text>
        <View style={{ width: 44 }} lightColor="transparent" darkColor="transparent" />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Contact card */}
        <View
          style={[styles.contactCard, { backgroundColor: colors.civicBlue + "18", borderColor: colors.civicBlue + "44" }]}
          lightColor="transparent"
          darkColor="transparent"
        >
          <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.civicBlue} />
          <View style={styles.contactText} lightColor="transparent" darkColor="transparent">
            <Text style={[styles.contactTitle, { color: theme.foreground }]}>Contact Support</Text>
            <Text style={[styles.contactSub, { color: theme.textSecondary }]}>
              We usually respond within a few hours.
            </Text>
          </View>
          <TouchableOpacity style={[styles.contactBtn, { backgroundColor: colors.civicBlue }]}>
            <Text style={[styles.contactBtnText, { color: colors.white }]}>Chat</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>FREQUENTLY ASKED</Text>

        {FAQS.map((faq, i) => (
          <View
            key={i}
            style={[styles.faqItem, { borderBottomColor: theme.border }]}
            lightColor="transparent"
            darkColor="transparent"
          >
            <Text style={[styles.faqQ, { color: theme.foreground }]}>{faq.q}</Text>
            <Text style={[styles.faqA, { color: theme.textSecondary }]}>{faq.a}</Text>
          </View>
        ))}
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
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: sp[4],
    borderRadius: rd.lg,
    borderWidth: 1,
    marginTop: sp[5],
    marginBottom: sp[6],
    gap: sp[3],
  },
  contactText: { flex: 1 },
  contactTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    marginBottom: sp[1],
  },
  contactSub: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  contactBtn: {
    paddingHorizontal: sp[4],
    paddingVertical: sp[2],
    borderRadius: rd.full,
  },
  contactBtnText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: sp[3],
  },
  faqItem: {
    paddingVertical: sp[4],
    borderBottomWidth: 1,
    gap: sp[2],
  },
  faqQ: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    lineHeight: 20,
  },
  faqA: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
});
