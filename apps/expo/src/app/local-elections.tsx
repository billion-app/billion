import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";

import { LocalBillsSection } from "~/components/LocalBillsSection";
import { RepsSection } from "~/components/RepsSection";
import { Text, View } from "~/components/Themed";
import { UpcomingMeetingsSection } from "~/components/UpcomingMeetingsSection";
import { useUserAddress } from "~/hooks/useUserAddress";
import {
  colors,
  fontBody,
  fontDisplay,
  fontSize,
  rd,
  sp,
  useTheme,
} from "~/styles";
import { coveredJurisdiction } from "~/utils/local-government";

/**
 * "Your Local Government" — city and county activity: local bills, upcoming
 * public meetings, and who represents you.
 *
 * This used to be "Where & How to Vote" and also carried polling places, key
 * dates, and an address card. All three moved to the How to Vote screen, which
 * is now the single home for voting logistics. What's left is the part that
 * was never about voting.
 *
 * Coverage note: Legistar is wired for San Jose, Santa Clara County, and
 * Sunnyvale only, and the router merges all three regardless of the reader's
 * address — so the header states the coverage instead of implying it's theirs.
 */
export default function LocalGovernmentScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { address } = useUserAddress();
  const covered = coveredJurisdiction(address);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + sp[3] }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome name="arrow-left" size={18} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {covered ? "Your Local Government" : "Local Government"}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Coverage is a scope, not a failure — say which governments these
            are rather than letting the reader assume they're theirs. */}
        {!covered && (
          <View style={styles.coverage}>
            <Text style={styles.coverageTitle}>
              Billion covers three Bay Area governments
            </Text>
            <Text style={styles.coverageBody}>
              San Jose, Santa Clara County, and Sunnyvale. Your area isn&apos;t
              one of them yet.
            </Text>
          </View>
        )}

        <LocalBillsSection />

        <UpcomingMeetingsSection />

        <RepsSection address={address} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: sp[4],
    paddingBottom: sp[4],
  },
  backButton: {
    padding: sp[3],
    marginLeft: -sp[3],
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: fontSize.xl,
    color: colors.white,
  },
  placeholder: {
    width: 34,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: sp[5],
  },
  coverage: {
    marginHorizontal: sp[4],
    marginBottom: sp[6],
    padding: sp[4],
    borderRadius: rd.lg,
    borderWidth: 1,
    borderColor: "rgba(74,124,255,0.30)",
    backgroundColor: "rgba(74,124,255,0.08)",
  },
  coverageTitle: {
    fontFamily: fontBody.semibold,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  coverageBody: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: "rgba(255,255,255,0.72)",
    marginTop: sp[1],
  },
});
