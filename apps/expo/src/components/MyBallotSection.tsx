import { StyleSheet, TouchableOpacity } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

import { AddressAutocomplete } from "~/components/AddressAutocomplete";
import { Text, View } from "~/components/Themed";
import {
  fontBody,
  fontDisplay,
  DigestHair,
  DigestPalette,
  DigestRadii,
  DigestSpace,
} from "~/styles";
interface MyBallotSectionProps {
  address: string | null;
  onAddressSubmit: (address: string) => void;
  onEditAddress: () => void;
  /** Navigate to the full ballot (main Your Ballot tab). */
  onViewBallot?: () => void;
}

/**
 * Address card for the civic hub. Captures / displays the registered address
 * and links out to the full ballot — it deliberately does NOT re-list the
 * contests, which live on the main "Your Ballot" tab. This screen is for
 * voting logistics, not a second copy of the ballot.
 *
 * Address entry goes through places.autocomplete / places.details (via
 * AddressAutocomplete) — same path as the Elections tab. Never invents a
 * council district from the address.
 */
export function MyBallotSection({
  address,
  onAddressSubmit,
  onEditAddress,
  onViewBallot,
}: MyBallotSectionProps) {
  if (!address) {
    return (
      <View style={styles.container}>
        <Text style={styles.kicker}>YOUR ADDRESS</Text>
        <Text style={styles.sectionTitle}>Where you vote</Text>
        <Text style={styles.hint}>
          We&apos;ll show your polling place, key dates, and who represents you
        </Text>
        <AddressAutocomplete onSubmit={onAddressSubmit} hint={null} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>YOUR ADDRESS</Text>
          <Text style={styles.sectionTitle}>Where you vote</Text>
        </View>
        <TouchableOpacity onPress={onEditAddress} style={styles.editButton}>
          <FontAwesome name="pencil" size={14} color={DigestPalette.spark} />
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.address}>{address}</Text>

      {onViewBallot && (
        <TouchableOpacity
          style={styles.ballotLink}
          onPress={onViewBallot}
          activeOpacity={0.8}
        >
          <FontAwesome
            name="check-square-o"
            size={15}
            color={DigestPalette.spark}
          />
          <Text style={styles.ballotLinkText}>View your full ballot</Text>
          <FontAwesome
            name="chevron-right"
            size={12}
            color={DigestPalette.quiet}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: DigestSpace.screenPadX,
    marginBottom: 24,
    padding: DigestSpace.cardBodyPadX,
    paddingBottom: DigestSpace.cardBodyPadBottom,
    borderRadius: DigestRadii.card,
    backgroundColor: DigestPalette.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  kicker: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: DigestPalette.spark,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 22,
    letterSpacing: -0.45,
    color: DigestPalette.inkOnNight,
  },
  hint: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: DigestPalette.quiet,
    marginBottom: 16,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
  },
  editText: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    color: DigestPalette.spark,
  },
  address: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: DigestPalette.quiet,
    lineHeight: 20,
  },
  ballotLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: DigestRadii.menu,
    marginTop: 16,
    backgroundColor: DigestPalette.canvas,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
  },
  ballotLinkText: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 13.5,
    color: DigestPalette.inkOnNight,
  },
});
