import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";

import type { Contest } from "@acme/api";

import { Text, View } from "~/components/Themed";
import { BallotMeasuresSection } from "~/components/BallotMeasuresSection";
import { CandidatesSection } from "~/components/CandidatesSection";
import { KeyDatesSection } from "~/components/KeyDatesSection";
import { LocalBillsSection } from "~/components/LocalBillsSection";
import { MyBallotSection } from "~/components/MyBallotSection";
import { useUserAddress } from "~/hooks/useUserAddress";
import { colors, fontDisplay, fontSize, sp, useTheme } from "~/styles";
import { trpc } from "~/utils/api";

export default function LocalElectionsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { address, setAddress, clearAddress } = useUserAddress();

  const electionsQuery = trpc.civic.getElections.useQuery();
  const upcomingElection = electionsQuery.data?.elections?.[0];

  const voterInfoQuery = trpc.civic.getVoterInfo.useQuery(
    { address: address ?? "" },
    { enabled: !!address },
  );

  const contests = voterInfoQuery.data?.contests ?? [];
  const measures = contests.filter((c: Contest) => c.referendumTitle);
  const candidateContests = contests.filter(
    (c: Contest) => c.candidates && c.candidates.length > 0,
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + sp.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={18} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Local Elections</Text>
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
        />

        {upcomingElection && (
          <KeyDatesSection electionDate={upcomingElection.electionDay} />
        )}

        <BallotMeasuresSection measures={measures} />

        <CandidatesSection contests={candidateContests} />

        <LocalBillsSection />
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
    paddingHorizontal: sp.md,
    paddingBottom: sp.md,
  },
  backButton: {
    padding: sp.sm,
    marginLeft: -sp.sm,
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
    paddingBottom: sp.xl,
  },
});
