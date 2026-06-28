import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { KeyDatesSection } from "~/components/KeyDatesSection";
import { LocalBillsSection } from "~/components/LocalBillsSection";
import { MyBallotSection } from "~/components/MyBallotSection";
import { PollingPlacesSection } from "~/components/PollingPlacesSection";
import { RepsSection } from "~/components/RepsSection";
import { Text, View } from "~/components/Themed";
import { UpcomingMeetingsSection } from "~/components/UpcomingMeetingsSection";
import { useUserAddress } from "~/hooks/useUserAddress";
import { colors, fontDisplay, fontSize, sp, useTheme } from "~/styles";
import { trpc } from "~/utils/api";
import { daysUntil } from "~/utils/dates";

/**
 * "Where & How to Vote" — the civic logistics hub. This is intentionally NOT a
 * second copy of the ballot (that lives on the Elections tab). It answers the
 * questions the ballot can't: where do I vote, when, who represents me, and
 * what's my city/county doing right now (local bills + meetings).
 */
export default function LocalElectionsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { address, setAddress, clearAddress } = useUserAddress();

  const electionsQuery = useQuery(trpc.civic.getElections.queryOptions());
  const upcomingElection = electionsQuery.data
    ?.filter((e) => daysUntil(e.electionDay) >= 0)
    .sort((a, b) => a.electionDay.localeCompare(b.electionDay))[0];

  const voterInfoQuery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({ address: address ?? "" }),
    enabled: !!address,
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + sp[3] }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome name="arrow-left" size={18} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Where & How to Vote</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <MyBallotSection
          address={address}
          onAddressSubmit={setAddress}
          onEditAddress={clearAddress}
          onViewBallot={() => router.push("/(tabs)/elections")}
        />

        <PollingPlacesSection
          pollingLocations={voterInfoQuery.data?.pollingLocations}
          earlyVoteSites={voterInfoQuery.data?.earlyVoteSites}
          dropOffLocations={voterInfoQuery.data?.dropOffLocations}
          mailOnly={voterInfoQuery.data?.mailOnly}
          isLoading={voterInfoQuery.isLoading}
          hasAddress={!!address}
        />

        {upcomingElection && (
          <KeyDatesSection electionDate={upcomingElection.electionDay} />
        )}

        <RepsSection contests={voterInfoQuery.data?.contests} />

        <LocalBillsSection />

        <UpcomingMeetingsSection />
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
});
