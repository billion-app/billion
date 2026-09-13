import { StyleSheet, TouchableOpacity } from "react-native";

import { AddressAutocomplete } from "~/components/AddressAutocomplete";
import { PinMark } from "~/components/digest/CraftMarks";
import { Text, View } from "~/components/Themed";
import { Icon } from "~/components/ui";
import {
  DigestHair,
  DigestPalette,
  DigestSpace,
  fontBody,
  fontDisplay,
} from "~/styles";

interface MyBallotSectionProps {
  address: string | null;
  onAddressSubmit: (address: string) => void;
  onEditAddress: () => void;
  /** Navigate to the full ballot (main Your Ballot tab). */
  onViewBallot?: () => void;
}

/**
 * Address cluster for the civic hub. Captures / displays the registered address
 * and links out to the full ballot — it deliberately does NOT re-list the
 * contests, which live on the main "Your Ballot" tab.
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
        <Text style={styles.kicker}>Address</Text>
        <Text style={styles.sectionTitle}>Where you vote</Text>
        <AddressAutocomplete onSubmit={onAddressSubmit} hint={null} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Address</Text>
      <TouchableOpacity
        onPress={onEditAddress}
        style={styles.addrRow}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Edit registered address"
      >
        <PinMark size={14} color={DigestPalette.spark} />
        <Text style={styles.address} numberOfLines={2}>
          {address}
        </Text>
        <Text style={styles.editText}>Edit</Text>
      </TouchableOpacity>

      {onViewBallot && (
        <TouchableOpacity
          style={styles.ballotLink}
          onPress={onViewBallot}
          activeOpacity={0.8}
        >
          <Text style={styles.ballotLinkText}>Full ballot</Text>
          <Icon name="chevR" size={15} color={DigestPalette.quiet} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: DigestSpace.screenPadX,
    marginBottom: 16,
  },
  kicker: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: DigestPalette.spark,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 28,
    letterSpacing: -0.6,
    color: DigestPalette.inkOnNight,
    marginBottom: 4,
  },
  addrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  editText: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: DigestPalette.spark,
  },
  address: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 15,
    color: DigestPalette.inkOnNight,
    lineHeight: 20,
  },
  ballotLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.sectionRule,
  },
  ballotLinkText: {
    flex: 1,
    fontFamily: fontDisplay.bold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: DigestPalette.inkOnNight,
  },
});
