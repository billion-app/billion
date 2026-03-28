/**
 * Terms & Privacy screen — settings sub-page
 *
 * STATUS:
 * - Terms text updated with generic legal text (to be replaced with legally reviewed copy before launch)
 * - Last updated date hardcoded to March 17, 2026 (should be fetched from CMS in future)
 * - Privacy Policy URL updated to https://billion.app/privacy (non-clickable text)
 * - Acceptance tracking not yet implemented (can be added later with AsyncStorage and backend sync)
 *
 * BACKEND INTEGRATION FUTURE:
 * - Fetch terms content from CMS or remote config for updates without app release
 * - Track terms acceptance with version timestamp via trpc.user.acceptTerms
 * - Last updated date should come from CMS metadata
 */

import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { colors, fonts, rd, sp, useTheme } from "~/styles";

// Terms version for future acceptance tracking
const _TERMS_VERSION = "1.0.0";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "By accessing or using the Billion application ('the Service'), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service ('Terms') and our Privacy Policy. If you do not agree to these Terms, you may not access or use the Service.",
  },
  {
    title: "2. Description of Service",
    body: "Billion provides AI-powered summaries and analyses of publicly available government documents for informational and educational purposes only. The Service is not intended to provide legal, financial, political, or professional advice. Users are solely responsible for verifying information through primary sources and consulting qualified professionals where appropriate.",
  },
  {
    title: "3. User Responsibilities",
    body: "You agree to use the Service in compliance with all applicable laws and regulations. You shall not misuse the Service, including but not limited to: attempting to reverse engineer, decompile, or disassemble any portion of the Service; interfering with the operation of the Service; or using the Service to generate harmful, misleading, or illegal content.",
  },
  {
    title: "4. Intellectual Property Rights",
    body: "All content, design, graphics, compilation, and other materials created by Billion, Inc. are the proprietary property of Billion, Inc. and are protected by copyright and other intellectual property laws. Government documents reproduced within the Service are in the public domain. AI-generated summaries and analyses are the intellectual property of Billion, Inc. You are granted a limited, non-exclusive, non-transferable license to access and use the Service for personal, non-commercial purposes.",
  },
  {
    title: "5. Privacy and Data Collection",
    body: "We collect and process personal data as described in our Privacy Policy. By using the Service, you consent to the collection, use, and sharing of your information as outlined therein. We implement reasonable security measures to protect your data, but we cannot guarantee absolute security.",
  },
  {
    title: "6. Disclaimers and Limitation of Liability",
    body: "THE SERVICE IS PROVIDED 'AS IS' AND 'AS AVAILABLE' WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, BILLION, INC. DISCLAIMS ALL WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE ARE NOT LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.",
  },
  {
    title: "7. Indemnification",
    body: "You agree to indemnify, defend, and hold harmless Billion, Inc., its affiliates, officers, directors, employees, and agents from any claims, liabilities, damages, losses, or expenses arising out of or in any way connected with your access to or use of the Service.",
  },
  {
    title: "8. Termination",
    body: "We reserve the right to suspend or terminate your access to the Service at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason.",
  },
  {
    title: "9. Modifications to Terms",
    body: "We may modify these Terms at any time. We will provide notice of material changes via the Service or through other communication methods. Your continued use of the Service after such modifications constitutes your acceptance of the updated Terms.",
  },
  {
    title: "10. Governing Law and Dispute Resolution",
    body: "These Terms shall be governed by the laws of the State of Delaware, without regard to its conflict of law principles. Any disputes arising under these Terms shall be resolved exclusively in the state or federal courts located in Delaware.",
  },
  {
    title: "11. Contact Information",
    body: "If you have any questions about these Terms, please contact us at legal@billion.app.",
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
          Terms & Privacy
        </Text>
        <View
          style={{ width: 44 }}
          lightColor="transparent"
          darkColor="transparent"
        />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lastUpdated, { color: theme.mutedForeground }]}>
          Last updated March 17, 2026
        </Text>

        {SECTIONS.map((section) => (
          <View
            key={section.title}
            style={styles.section}
            lightColor="transparent"
            darkColor="transparent"
          >
            <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
              {section.title}
            </Text>
            <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>
              {section.body}
            </Text>
          </View>
        ))}

        <View
          style={[
            styles.privacyCard,
            {
              backgroundColor: colors.civicBlue + "18",
              borderColor: colors.civicBlue + "44",
            },
          ]}
          lightColor="transparent"
          darkColor="transparent"
        >
          <Text style={[styles.privacyCardTitle, { color: theme.foreground }]}>
            Privacy Policy
          </Text>
          <Text
            style={[styles.privacyCardBody, { color: theme.textSecondary }]}
          >
            Our full Privacy Policy is available at https://billion.app/privacy
            and governs all data collection, storage, and processing activities
            associated with the Service.
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
