/**
 * Help & Support screen — settings sub-page
 *
 * STATUS:
 * - FAQs are hardcoded — replace with CMS-driven content (e.g. fetched from Contentful or tRPC) [BACKEND TODO]
 * - "Chat" button replaced with Email link — integrate with a support SDK (e.g. Intercom, Zendesk) [BACKEND TODO]
 * - "Report a bug" shortcut added — navigates to feedback form with category="bug"
 * - Search functionality added — filters FAQs client-side
 * - FAQ items are collapsible accordions — toggle by tapping question
 *
 * BACKEND INTEGRATION FUTURE:
 * - Fetch FAQ content from CMS via tRPC endpoint (`content.faq.list`)
 * - Integrate with Intercom/Zendesk SDK for in-app chat
 * - Implement backend search endpoint for more comprehensive help articles
 */

import { useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { colors, fonts, rd, sp, useTheme } from "~/styles";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaqs, setExpandedFaqs] = useState<Set<string>>(new Set());

  const toggleFaq = (question: string) => {
    const newSet = new Set(expandedFaqs);
    if (newSet.has(question)) {
      newSet.delete(question);
    } else {
      newSet.add(question);
    }
    setExpandedFaqs(newSet);
  };

  const filteredFaqs = FAQS.filter(
    (faq) =>
      faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.a.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      <View
        style={[
          styles.header,
          {
            borderBottomColor: theme.border,
            backgroundColor: theme.background,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.foreground }]}>
          Help & Support
        </Text>
        <View
          style={{ width: 44 }}
          lightColor="transparent"
          darkColor="transparent"
        />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Contact card */}
        <View
          style={[
            styles.contactCard,
            {
              backgroundColor: colors.civicBlue + "18",
              borderColor: colors.civicBlue + "44",
            },
          ]}
          lightColor="transparent"
          darkColor="transparent"
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={28}
            color={colors.civicBlue}
          />
          <View
            style={styles.contactText}
            lightColor="transparent"
            darkColor="transparent"
          >
            <Text style={[styles.contactTitle, { color: theme.foreground }]}>
              Contact Support
            </Text>
            <Text style={[styles.contactSub, { color: theme.textSecondary }]}>
              We usually respond within a few hours.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: colors.civicBlue }]}
            onPress={() => Linking.openURL("mailto:Thatxliner@gmail.com")}
          >
            <Text style={[styles.contactBtnText, { color: colors.white }]}>
              Email
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bug report card */}
        <View
          style={[
            styles.bugCard,
            {
              backgroundColor: colors.teal + "18",
              borderColor: colors.teal + "44",
            },
          ]}
          lightColor="transparent"
          darkColor="transparent"
        >
          <Ionicons name="bug-outline" size={28} color={colors.teal} />
          <View
            style={styles.bugText}
            lightColor="transparent"
            darkColor="transparent"
          >
            <Text style={[styles.bugTitle, { color: theme.foreground }]}>
              Report a Bug
            </Text>
            <Text style={[styles.bugSub, { color: theme.textSecondary }]}>
              Found an issue? Let us know.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.bugBtn, { backgroundColor: colors.teal }]}
            onPress={() => router.push("/settings/feedback?category=bug")}
          >
            <Text style={[styles.bugBtnText, { color: colors.white }]}>
              Report
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          FREQUENTLY ASKED
        </Text>

        {/* Search input */}
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          lightColor="transparent"
          darkColor="transparent"
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={theme.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search FAQs..."
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.searchInput,
              {
                color: theme.foreground,
                marginRight: searchQuery.length > 0 ? sp[3] : 0,
              },
            ]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {filteredFaqs.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No FAQs match your search.
          </Text>
        ) : (
          filteredFaqs.map((faq, i) => {
            const isExpanded = expandedFaqs.has(faq.q);
            return (
              <View
                key={i}
                style={[styles.faqItem, { borderBottomColor: theme.border }]}
                lightColor="transparent"
                darkColor="transparent"
              >
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => toggleFaq(faq.q)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.faqQ, { color: theme.foreground }]}>
                    {faq.q}
                  </Text>
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
                {isExpanded && (
                  <Text style={[styles.faqA, { color: theme.textSecondary }]}>
                    {faq.a}
                  </Text>
                )}
              </View>
            );
          })
        )}
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
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bugCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: sp[4],
    borderRadius: rd.lg,
    borderWidth: 1,
    marginTop: sp[5],
    marginBottom: sp[5],
    gap: sp[3],
  },
  bugText: { flex: 1 },
  bugTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    marginBottom: sp[1],
  },
  bugSub: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  bugBtn: {
    paddingHorizontal: sp[4],
    paddingVertical: sp[2],
    borderRadius: rd.full,
  },
  bugBtnText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: sp[3],
    paddingHorizontal: sp[4],
    borderRadius: rd.lg,
    borderWidth: 1,
    marginBottom: sp[4],
  },
  searchIcon: {
    marginRight: sp[3],
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    paddingVertical: 0,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: sp[8],
  },
});
