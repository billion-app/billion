import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { KeyDatesSection } from "~/components/KeyDatesSection";
import { LocalDecisionsPreview } from "~/components/LocalDecisionsPreview";
import { MyBallotSection } from "~/components/MyBallotSection";
import { PollingPlacesSection } from "~/components/PollingPlacesSection";
import { RepsSection } from "~/components/RepsSection";
import { NavHeader } from "~/components/ui";
import { useUserAddress } from "~/hooks/useUserAddress";
import { DigestPalette } from "~/styles";
import { trpc } from "~/utils/api";
import {
  earliestEarlyVoteStart,
  pickUpcomingCaliforniaElection,
} from "~/utils/elections";

/**
 * Civic logistics: polling locations, dates, reps, local decisions.
 */
export default function LocalElectionsScreen() {
  const router = useRouter();
  const { address, setAddress, clearAddress } = useUserAddress();

  const electionsQuery = useQuery({
    ...trpc.civic.getElections.queryOptions(),
    enabled: !address,
  });
  const voterInfoQuery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({ address: address ?? "" }),
    enabled: !!address,
  });

  // Address-resolved election wins. Without an address, only a CA-relevant
  // row from getElections — never the soonest nationwide race.
  const calendarElection = address
    ? voterInfoQuery.data?.election
    : pickUpcomingCaliforniaElection(electionsQuery.data ?? []);

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
          <KeyDatesSection
            electionDate={calendarElection.electionDay}
            earlyVoteStart={earliestEarlyVoteStart(
              voterInfoQuery.data?.earlyVoteSites,
            )}
          />
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
});
