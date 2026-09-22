import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { EmptyBallotMark } from "~/components/digest/CraftMarks";
import { KeyDatesSection } from "~/components/KeyDatesSection";
import { LocalDecisionsPreview } from "~/components/LocalDecisionsPreview";
import { MyBallotSection } from "~/components/MyBallotSection";
import { PollingPlacesSection } from "~/components/PollingPlacesSection";
import { RepsSection } from "~/components/RepsSection";
import { Text } from "~/components/Themed";
import { NavHeader } from "~/components/ui";
import { useUserAddress } from "~/hooks/useUserAddress";
import { DigestPalette, fontBody, fontDisplay } from "~/styles";
import { trpc } from "~/utils/api";
import {
  pickUpcomingCaliforniaElection,
} from "~/utils/elections";
import { electionsAreLive } from "~/utils/elections-live";

/**
 * Civic logistics: polling locations, dates, reps, local decisions.
 */
export default function LocalElectionsScreen() {
  const router = useRouter();
  const { address, setAddress, clearAddress } = useUserAddress();

  const electionsQuery = useQuery({
    ...trpc.civic.getElections.queryOptions(),
    enabled: electionsAreLive() && !address,
  });
  const voterInfoQuery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({ address: address ?? "" }),
    enabled: electionsAreLive() && !!address,
  });

  // Address-resolved election wins. Without an address, only a CA-relevant
  // row from getElections — never the soonest nationwide race.
  const calendarElection = address
    ? voterInfoQuery.data?.election
    : pickUpcomingCaliforniaElection(electionsQuery.data ?? []);

  if (!electionsAreLive()) {
    return (
      <View style={styles.container}>
        <NavHeader title="Elections" onBack={() => router.back()} />
        <View
          style={styles.comingSoon}
          accessibilityRole="text"
          accessibilityLabel="Elections page coming soon"
        >
          <EmptyBallotMark width={96} />
          <Text style={styles.comingSoonTitle}>Elections page coming soon</Text>
          <Text style={styles.comingSoonDek}>
            Voter tools are still in progress. This tab will open the ballot
            when they are ready.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavHeader title="Where to vote" onBack={() => router.back()} />

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

        {calendarElection && (
          <KeyDatesSection electionDate={calendarElection.electionDay} />
        )}

        <RepsSection address={address} />

        <LocalDecisionsPreview address={address} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DigestPalette.canvas,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  comingSoon: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  comingSoonTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: DigestPalette.inkOnNight,
    textAlign: "center",
  },
  comingSoonDek: {
    fontFamily: fontBody.medium,
    fontSize: 15,
    lineHeight: 22,
    color: DigestPalette.quiet,
    textAlign: "center",
    maxWidth: 280,
  },
});
